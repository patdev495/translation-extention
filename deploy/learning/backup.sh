#!/bin/sh
set -eu

data_dir=/var/lib/polytranslate-learning
backup_dir=/var/backups/polytranslate-learning
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

docker exec -i polytranslate-learning-backend python - <<'PY'
import sqlite3
from pathlib import Path

source = Path('/data/learning.sqlite3')
temporary = Path('/data/learning.backup.sqlite3')
if not source.is_file():
    raise SystemExit('Learning database does not exist')
with sqlite3.connect(source) as live, sqlite3.connect(temporary) as backup:
    live.backup(backup)
    result = backup.execute('PRAGMA quick_check').fetchone()[0]
    if result != 'ok':
        raise SystemExit(f'Backup verification failed: {result}')
PY

install -m 600 "$data_dir/learning.backup.sqlite3" "$backup_dir/learning-$stamp.sqlite3"
rm -f "$data_dir/learning.backup.sqlite3"
find "$backup_dir" -maxdepth 1 -type f -name 'learning-*.sqlite3' -mtime +13 -delete
