# iPhone Mandarin voice fix — production release

- Deployed: 2026-11-09; production browser check at 2026-11-09T07:39:43Z.
- URL: https://learning.peebot.shop
- Commit: `541c4e3cfc5f3fa33a5526d1510fd532c686ac5c`.
- Previous release: `9e8a0180cfd121595d8c22507a93f34ef4bf5275`.
- Source archive: committed `web/` and `deploy/learning/` only, SHA-256 `573fee9daf751f29e10e1df1994568d5048247f08bc1e9c8ba83c5961402150a` verified on VPS before deployment.
- Deployment used the repository's `deploy/learning/release.sh`; source and previous image tags retained for rollback.
- Backup: `/var/backups/polytranslate-learning/releases/541c4e3cfc5f3fa33a5526d1510fd532c686ac5c/`; fresh SQLite backup passed `PRAGMA quick_check` before release.
- Production `RELEASE` contains the new commit, frontend is running, backend is healthy, and HTTPS `/api/health` returns `{"status":"ok"}`.

## Validation

Before release: 56 web tests passed and `npm run build` passed (including Vue TypeScript checks). Docker production build also passed.

After release: `smoke.mjs` loaded the actual production frontend assets in Chromium 158 at 390 × 844. All account/review HTTP endpoints were intercepted with fixtures, with no production account or data writes. Speech-device fixtures verified empty-list Mandarin playback starts within the tap gesture, installation guidance appears for missing Mandarin and language-unavailable, Cantonese is not selected, and the flashcard stays usable without overflow or page errors. Results: `smoke.json`; screenshot: `production-voice-check.png`.

HTTPS assets match the tested local production build byte for byte:

| Asset | SHA-256 |
| --- | --- |
| `index-B5TVa3Sf.js` | `d9eccadd9b73939c9dd14f65de3a8eace022d04c5f3970503d7a6211db664e70` |
| `index-O-4q337W.css` | `d993142cfe00f79864d576b540d8b15c1bc3887bd6434bd4cc7b257bcb74146b` |

Backend source hashes remain the same as the previous release (`main.py`: `c3c966cf9ace88afca5cbde13094f8f304ba8a11ace340609293aa544c38b97d`; `database.py`: `e7aecdc8058e9daa675bda50c3dc176044f0e58ec2a330363a796ba6ba9ec026`).

No physical iPhone audio test was performed. Devices genuinely missing a Mandarin voice still require installing one in iOS settings. This release handles an initially empty voice list and improves the installation guidance; it does not add server speech synthesis.
