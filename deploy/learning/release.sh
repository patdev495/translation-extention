#!/usr/bin/env bash
# Deploy a committed source archive; keep images, source and a verified DB backup.
set -euo pipefail

revision=${1:?Usage: release.sh <full-git-revision>}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid revision' >&2; exit 1; }
source_dir=/opt/polytranslate-learning
archive=/tmp/polytranslate-$revision.tar
backup_dir=/var/backups/polytranslate-learning/releases/$revision
compose=$source_dir/deploy/learning/compose.yml
[[ -f "$archive" && -f "$compose" ]] || { echo 'Source archive or Compose file missing' >&2; exit 1; }
[[ ! -e "$backup_dir" ]] || { echo 'Release backup already exists; inspect it before retrying' >&2; exit 1; }

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
docker inspect --format '{{.Image}}' polytranslate-learning-backend > "$backup_dir/backend-image"
docker inspect --format '{{.Image}}' polytranslate-learning-frontend > "$backup_dir/frontend-image"
docker image tag "$(cat "$backup_dir/backend-image")" "polytranslate-rollback-backend:$revision"
docker image tag "$(cat "$backup_dir/frontend-image")" "polytranslate-rollback-frontend:$revision"
tar -cf "$backup_dir/source.tar" -C "$source_dir" web deploy

if ! systemctl start polytranslate-learning-backup.service; then
  bash "$source_dir/deploy/learning/backup.sh"
fi
python3 - "$backup_dir" <<'PY'
import shutil
import sqlite3
import sys
import time
from pathlib import Path

backups = list(Path('/var/backups/polytranslate-learning').glob('learning-*.sqlite3'))
if not backups:
    raise SystemExit('Database backup missing')
latest = max(backups, key=lambda path: path.stat().st_mtime)
if time.time() - latest.stat().st_mtime > 300:
    raise SystemExit('Database backup is not fresh')
target = Path(sys.argv[1]) / 'learning.sqlite3'
shutil.copy2(latest, target)
target.chmod(0o600)
with sqlite3.connect(f'file:{target}?mode=ro', uri=True) as connection:
    if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        raise SystemExit('Database backup verification failed')
print('Verified database backup:', target)
PY

rollback() {
  result=$?
  trap - ERR
  echo 'Deployment failed; restoring previous source and images.' >&2
  tar -xf "$backup_dir/source.tar" -C "$source_dir"
  docker image tag "polytranslate-rollback-backend:$revision" learning-backend
  docker image tag "polytranslate-rollback-frontend:$revision" learning-frontend
  docker compose -p learning -f "$compose" up -d --no-build --force-recreate
  # Schema changes are additive. Keep live writes; the DB backup is for manual recovery.
  exit "$result"
}
trap rollback ERR

tar -xf "$archive" -C "$source_dir"
docker compose -p learning -f "$compose" build
docker compose -p learning -f "$compose" up -d --no-build

ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:8070/api/health; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]]
curl --fail --silent --show-error --max-time 15 https://learning.peebot.shop/api/health
printf '%s\n' "$revision" > "$source_dir/RELEASE"
printf '%s\n' "$revision" > "$backup_dir/deployed-revision"
trap - ERR
echo
echo "Deployed $revision"
