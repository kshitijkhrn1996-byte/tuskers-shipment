"""Local API server: loads .env then runs uvicorn on :8000."""
import os
from pathlib import Path

for line in (Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k, v)

import sys  # noqa: E402

import uvicorn  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

uvicorn.run("server.main:app", port=8000, reload=False)
