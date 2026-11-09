"""Independent test server so concurrent work can keep using port 5174."""
import os
from pathlib import Path
import sys
import tempfile

import uvicorn
from fastapi.staticfiles import StaticFiles

root = Path(__file__).resolve().parents[2] / "web"
sys.path.insert(0, str(root))
with tempfile.TemporaryDirectory(prefix="polytranslate-library-audio-") as directory:
    os.environ.update(POLY_LEARNING_DB=str(Path(directory) / "learning.sqlite3"),
                      POLY_WEB_ORIGIN="http://127.0.0.1:5178", POLY_SECURE_COOKIES="0")
    from server.main import create_app

    app = create_app()
    app.mount("/", StaticFiles(directory=root / "dist", html=True), name="frontend")
    uvicorn.run(app, host="127.0.0.1", port=5178)
