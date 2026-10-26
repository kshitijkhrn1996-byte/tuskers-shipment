"""Minimal Supabase (PostgREST) client using the service role key."""
import os
from typing import Any, Optional

import httpx


def _client() -> httpx.Client:
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/"
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return httpx.Client(base_url=url, timeout=15, headers={
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "return=representation"})


def insert(table: str, rows: Any) -> list[dict]:
    with _client() as c:
        r = c.post(table, json=rows)
        r.raise_for_status()
        return r.json()


def update(table: str, match: dict, values: dict) -> list[dict]:
    with _client() as c:
        r = c.patch(table, params={k: f"eq.{v}" for k, v in match.items()}, json=values)
        r.raise_for_status()
        return r.json()


def select(table: str, params: Optional[dict] = None) -> list[dict]:
    with _client() as c:
        r = c.get(table, params=params or {})
        r.raise_for_status()
        return r.json()


def get_one(table: str, **match) -> Optional[dict]:
    rows = select(table, {**{k: f"eq.{v}" for k, v in match.items()}, "limit": 1})
    return rows[0] if rows else None


def count(table: str) -> int:
    with _client() as c:
        r = c.head(table, params={"select": "id"}, headers={"Prefer": "count=exact", "Range": "0-0"})
        r.raise_for_status()
        return int(r.headers.get("content-range", "*/0").split("/")[-1] or 0)
