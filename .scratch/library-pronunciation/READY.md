# Library pronunciation — ready for production

Status: done

Deployed on 2026-11-09 after explicit user approval. Source archive SHA-256 passed on the VPS; the release script verified a fresh SQLite backup under `/var/backups/polytranslate-learning/releases/19dbdd876a14a086802beb3c7b6ee6d4fb926c78/`, retained previous source/images, built the committed frontend and completed deployment. Backend remained healthy, and internal plus public HTTPS health checks returned `{"status":"ok"}`. Production `RELEASE` was set to `19dbdd876a14a086802beb3c7b6ee6d4fb926c78`. Test suites were not rerun, as requested.

Commit: `19dbdd876a14a086802beb3c7b6ee6d4fb926c78`.

Words or Phrases and Sentences have a 44 px pronunciation button in the Learning Library and linked-item dialog. Tapping the active button stops playback; another entry replaces playback. Hidden Chinese/Pinyin fields do not disable audio. Navigation, page hiding and unmounting stop playback. Audio errors appear with the relevant entry. Playback reuses the existing Mandarin device voice implementation.

Validation: all 59 web tests passed; Vue TypeScript checks and production build passed. Three browser checks passed on iPhone-sized WebKit, mobile Chromium and desktop Chromium, using a real isolated API/SQLite server and fixtures only at the speech-device boundary. Screenshots are under `browser-results/`. Physical iPhone audio was not retested.

Committed source archive uploaded to `/tmp/polytranslate-19dbdd876a14a086802beb3c7b6ee6d4fb926c78.tar` on the existing VPS. SHA-256: `62c036ccbc55e1372aff542c3a447d093db117ae741a12a6269c3b3893946546`.

The first deployment attempt was rejected before execution pending explicit authorization. The user then explicitly requested production deployment without rerunning tests; the authorized release succeeded. Previous release: `541c4e3cfc5f3fa33a5526d1510fd532c686ac5c`.

Deployment used `deploy/learning/release.sh` with its existing backup, rollback and health checks. No new browser test run was performed after deployment, as requested.

Expected production build assets:

- `index-CD55ExL8.js`: `1de6c248a539a21f75c80908f9a9a890322263647d9fdef8436645fe9bb52bfe`.
- `index-Bb-rHZZd.css`: `0a1cd3bf12c28ea3ef7eee346aa6b7665b3681f56a6f5b48e4f21c76df088f92`.
