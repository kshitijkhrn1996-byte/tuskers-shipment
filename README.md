# Team Tuskers - Conversational Shipment Booking MVP

```
backend/
  app/
    schemas.py      Pydantic v2 models: Booking, Item, allowed values
    carriers.py     Sheet 3 rate card (PLACEHOLDER - replace with template values)
    rulebook.py     Deterministic engine for R-01..R-10
    main.py         FastAPI app            (Phase 1 - todo)
    excel.py        Sheets 1+2 parser      (Phase 2 - todo)
    recommender.py  Carrier ranking + WSM  (Phase 2 - todo)
    agent/          LangGraph conversation (Phase 3 - todo)
  tests/test_rulebook.py
frontend/           React + Tailwind + react-globe.gl (Phase 1/4 - todo)
```

Run tests: `cd backend && pip install -r requirements.txt && pytest -q`
