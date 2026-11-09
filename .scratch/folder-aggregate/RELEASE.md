# Mở tất cả danh sách

Status: done

Deployed to https://learning.peebot.shop on 2026-11-09 after the user's explicit request to finish and deploy.

- Commit: `2cec36cc252d7a923be012b25ef4db0ac683d392`.
- Previous release: `19dbdd876a14a086802beb3c7b6ee6d4fb926c78`.
- Archive SHA-256 verified on VPS: `d81de763fe4acfe282ffa736012fcaf443b7be030c3b4f6e6bca21fe6df7aff2`.
- Release script saved prior source/images and verified a fresh SQLite backup at `/var/backups/polytranslate-learning/releases/2cec36cc252d7a923be012b25ef4db0ac683d392/learning.sqlite3` before deployment.
- Backend became healthy; both internal and HTTPS health checks returned `{"status":"ok"}`. The deployment completed and wrote the new production `RELEASE` revision.

The selected folder offers **Mở tất cả danh sách** when it has child folders. This opens one ordinary item list spanning the selected folder and all descendants, including Word or Phrase, Sentence, Grammar and Note. Folder tiles are hidden in the aggregate view; filtering, sorting, pagination, pronunciation, editing and item selection remain available. **Về thư mục** restores direct contents. Navigation and scope changes clear selection and reset pagination/filtering. Bulk trash in aggregate scope is opt-in, atomic, ownership checked, excludes unrelated folders, and keeps folder structure.

Validation before deployment: 62 web tests, 46 API tests, Vue TypeScript checks, production build, and three real-browser checks using an isolated API/SQLite server on iPhone-sized WebKit, mobile Chromium and desktop Chromium. Browser checks cover nested categories, filtering, pronunciation controls, scoped selected/bulk trash, preservation of outside entries/folder structure and navigation back. Screenshots are in `browser-results/`.

Expected source/build SHA-256:

- `index-CZgfdvT2.js`: `528a22322a41c545b8ef22c5dc84be6a898a77ca01aa1acee23f7cbf09a5486f`.
- `index-CIbS0oVS.css`: `f007b4ebd639087dca2226e8761b22aaebec77129276f9cca06528b7409d4378`.
- `server/main.py`: `0c7042bc26ad8daa8d782689d83027855831e3390aef667f6937a40948c3793e`.
