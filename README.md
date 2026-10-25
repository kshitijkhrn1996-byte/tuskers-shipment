# Team Tuskers - Conversational Shipment Booking MVP

Live: https://tuskers-shipment.vercel.app (no login)

Book a UK → Germany/France/Netherlands pallet shipment by chatting or by uploading the
Bookings + Items sheets. Every booking is checked against rules R-01..R-10, gets a carrier
recommendation for the seller's priority, and a plain-language confirmation.

```
api/index.py        Vercel entrypoint (FastAPI app)
server/
  schemas.py        Pydantic v2 models: Booking, Item, allowed values
  carriers.py       Sheet 3 rate card (PLACEHOLDER - replace with template values)
  rulebook.py       Deterministic engine for R-01..R-10
  recommender.py    Route/weight filter + ranking (Balanced = min-max + weighted sum)
  evaluate.py       Checks + carrier + confirmation for one booking
  excel.py          Sheets 1+2 parser
  agent.py          LangGraph conversation (Gemini extracts, code decides)
  db.py             Supabase (ts_* tables)
  main.py           API routes
src/                React + Tailwind frontend (chat, upload, results, globe, help widget)
scripts/            make_sample.py (planted-error workbook), chat_demo.py, serve.py
tests/              pytest
```

Local dev: copy `.env.example` to `.env`, then
`python -m venv .venv && .venv/Scripts/pip install -r requirements.txt uvicorn pytest`,
`npm install`, run `python scripts/serve.py` (API :8000) and `npm run dev` (web :5173).

Tests: `PYTHONPATH=. .venv/Scripts/python -m pytest -q`

Pushes to `main` deploy to production on Vercel.
