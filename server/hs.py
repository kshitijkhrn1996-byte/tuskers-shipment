"""HS code reference checks and finder, backed by the ts_hs_codes table.

- lookup():      does the code exist? returns its chapter / heading / subheading wording.
- judge_match(): does the product description fit that code? Gemini decides, but only
                 from the official wording we hand it, and any code it suggests must exist.
- find():        description -> verified codes. Gemini first picks chapters from the real
                 chapter list, then picks subheadings from that chapter's real rows, so it
                 can only return codes that are in the nomenclature.

The nomenclature is cached in memory per process; the bundled CSV is a fallback if
the database can't be reached.
"""
import csv
import hashlib
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

from . import db
from . import hs_match
from .hs_match import CODES as CN8

CSV = Path(__file__).resolve().parent / "data" / "hs_codes.csv"
PRODUCTS = {(p["commodity_code"], p["product"]): p for p in hs_match.P}
RESERVED = {"77", "98", "99"}


@lru_cache(maxsize=1)
def index() -> dict[str, dict]:
    rows: list[dict] = []
    try:
        for start in range(0, 8000, 1000):
            page = db.select("ts_hs_codes", {"select": "code,description,parent,level", "order": "code",
                                             "offset": start, "limit": 1000})
            rows += page
            if len(page) < 1000:
                break
    except Exception:
        rows = []
    if len(rows) < 6000:  # database unreachable or not loaded: use the bundled copy
        with open(CSV, encoding="utf-8") as f:
            rows = [{"code": r["hscode"], "description": r["description"], "level": int(r["level"]),
                     "parent": None if r["parent"] == "TOTAL" else r["parent"]}
                    for r in csv.DictReader(f) if r["level"] in ("2", "4", "6")]
    # chapters 77, 98 and 99 are reserved / national-use, not real classifications
    return {r["code"]: r for r in rows if r["code"][:2] not in RESERVED}


def lookup(code: Optional[str]) -> Optional[dict]:
    """Return {code, subheading, heading, chapter} for a 6+ digit code, or None if it doesn't exist.
    UK commodity codes (8 or 10 digits) are checked on their first 6 digits."""
    if not code or not str(code).isdigit() or len(str(code)) < 6:
        return None
    idx = index()
    six = str(code)[:6]
    row = idx.get(six)
    if not row:
        return None
    heading = idx.get(six[:4], {})
    chapter = idx.get(six[:2], {})
    info = {"code": six, "subheading": row["description"], "heading": heading.get("description", ""),
            "chapter": chapter.get("description", ""), "chapter_code": six[:2], "heading_code": six[:4]}
    if len(str(code)) >= 8:  # UK/EU commodity code: the 8-digit line must exist too
        cn = CN8.get(str(code)[:8])
        if not cn:
            return None
        info.update(code=cn["code"], subheading=cn["d"].split(" > ")[-1], tariff=cn["d"])
    return info


def _gemini_json(prompt: str) -> dict:
    from .agent import _gemini
    return json.loads(_gemini(prompt))


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


# ---------- does the description fit the code? ----------

MATCH_PROMPT = """You are checking a customs declaration. Decide whether the product fits the HS code,
using ONLY the official HS wording below. Be practical: the wording is generic; a product fits if it
belongs in that subheading. If it clearly belongs in a different chapter or heading, answer "no".

Product description: {desc}
HS {code}
  Chapter {cc}: {chapter}
  Heading {hc}: {heading}
  Subheading {code}: {sub}

Return ONLY JSON: {{"fits": "yes" | "no" | "unsure", "reason": "one short sentence for a small seller"}}"""


def judge_match(description: str, code: str, suggest: bool = False) -> Optional[dict]:
    """{'fits': yes|no|unsure, 'reason', 'suggestions': [...]} or None if it can't be judged."""
    info = lookup(code)
    if not info or not description or not os.environ.get("GEMINI_API_KEY"):
        return None
    key = hashlib.sha1(f"{_norm(description)}|{info['code']}".encode()).hexdigest()
    hit = None
    try:
        hit = db.get_one("ts_hs_matches", key=key)
        if hit and (not suggest or hit["verdict"]["fits"] != "no" or hit["verdict"].get("suggestions")):
            return hit["verdict"]
    except Exception:
        pass
    try:
        v = _gemini_json(MATCH_PROMPT.format(desc=description, code=info["code"], cc=info["chapter_code"],
                                             chapter=info["chapter"], hc=info["heading_code"], heading=info["heading"],
                                             sub=info["subheading"]))
    except Exception:
        return None
    verdict = {"fits": v.get("fits", "unsure"), "reason": v.get("reason", ""), "suggestions": []}
    if verdict["fits"] == "no" and suggest:
        verdict["suggestions"] = find(description, limit=3)
    try:
        if hit:
            db.update("ts_hs_matches", {"key": key}, {"verdict": verdict})
        else:
            db.insert("ts_hs_matches", {"key": key, "verdict": verdict})
    except Exception:
        pass
    return verdict


# ---------- description -> verified codes ----------

CHAPTER_PROMPT = """Pick the HS chapters a product most likely belongs to. Use only chapters from this list.

Product: {q}

Chapters:
{chapters}

Return ONLY JSON: {{"chapters": ["2-digit code", ...]}} with 1 to 3 chapters, best first."""

PICK_PROMPT = """Pick the HS subheadings that best classify this product. Choose ONLY from the list.

Product: {q}

Subheadings:
{rows}

Return ONLY JSON: {{"codes": [{{"code": "6-digit code from the list", "why": "short reason"}}]}} with up to {n}, best first."""


def find(query: str, limit: int = 5) -> list[dict]:
    return find_full(query, limit)["results"]


def find_full(query: str, limit: int = 5) -> dict:
    """Description or code -> {"results": [...], "notices": [...]}.

    1. Deterministic matcher over the curated common-products list and the 11.5k UK/EU
       8-digit commodity codes (instant, no AI). Vague, restricted and ambiguous terms
       come back as notices instead of guesses.
    2. Only when the matcher is unsure, Gemini picks from the real chapter list and then
       from that chapter's real subheadings, expanded to their 8-digit lines.
    """
    q = (query or "").strip()
    if not q:
        return {"results": [], "notices": []}
    out = hs_match.suggest(q, k=limit)
    notices = [{"kind": k.lower(), "message": msg} for k, _, msg in out
               if k in ("VAGUE", "RESTRICTED", "AMBIGUOUS", "NONE", "INVALID")]
    results, confident = [], False
    for kind, code, label in out:
        if kind in ("LIST", "LIST_LOW"):
            p = PRODUCTS.get((code, label))
            if p:
                confident |= kind == "LIST"
                results.append({"code": code, "subheading": p["tariff_description"].split(" > ")[-1], "product": p["product"],
                                "heading": p["hs6_description"], "chapter": p["chapter_description"],
                                "why": p.get("deciding_question") or "", "source": "common products"})
        elif kind in ("CN8", "CODE", "HS6") and code in CN8:
            confident |= kind in ("CODE", "HS6")
            results.append(_result(code))
    if any(n["kind"] in ("vague", "restricted", "invalid") for n in notices):
        notices = [n for n in notices if n["kind"] != "none"]
        return {"results": results if not any(n["kind"] == "vague" for n in notices) else [], "notices": notices}
    if not confident and os.environ.get("GEMINI_API_KEY") and not re.fullmatch(r"[\d .]+", q):
        ai = _ai_find(q, limit)
        results = ai + [r for r in results if r["code"] not in {x["code"] for x in ai}]
        notices = [n for n in notices if n["kind"] != "none"]
    return {"results": results[:limit], "notices": notices}


def _ai_find(q: str, limit: int) -> list[dict]:
    idx = index()
    results: list[dict] = []
    try:
        chapters = "\n".join(f"{c} {r['description']}" for c, r in sorted(idx.items()) if r["level"] == 2)
        picked = _gemini_json(CHAPTER_PROMPT.format(q=q, chapters=chapters)).get("chapters", [])[:3]
        picked = [str(c).zfill(2) for c in picked if str(c).zfill(2) in idx]
        rows = "\n".join(f"{c} {r['description']}" for c, r in sorted(idx.items()) if r["level"] == 6 and c[:2] in picked)
        if not rows:
            return []
        for ch in _gemini_json(PICK_PROMPT.format(q=q, rows=rows, n=3)).get("codes", []):
            six = str(ch.get("code", ""))
            if six not in idx or idx[six]["level"] != 6:
                continue
            lines = [c for c, v in CN8.items() if v["hs6"] == six][:2]
            for code in lines or [six]:
                if all(r["code"] != code for r in results):
                    results.append({**_result(code), "why": ch.get("why", ""), "source": "AI, from the nomenclature"})
    except Exception:
        return results
    return results[:limit]


def _result(code: str) -> dict:
    info = lookup(code)
    return {"code": code, "subheading": info["subheading"], "heading": info.get("tariff") or info["heading"],
            "chapter": info["chapter"], "source": "UK/EU tariff"}


# ---------- seller product catalogue ----------

def catalogue(skus: list[str]) -> dict[str, dict]:
    skus = [s for s in {(s or "").strip() for s in skus} if s and not s.startswith("ITEM-")]
    if not skus:
        return {}
    try:
        rows = db.select("ts_products", {"sku": f"in.({','.join(json.dumps(s) for s in skus)})"})
    except Exception:
        return {}
    return {r["sku"]: r for r in rows}


def remember(items: list[dict]):
    """Record confirmed products so later bookings of the same SKU can be cross-checked."""
    for it in items:
        sku = (it.get("sku") or "").strip()
        if not sku or sku.startswith("ITEM-") or not it.get("description"):
            continue
        row = {"sku": sku, "description": it["description"], "hs_code": it.get("hs_code"),
               "country_of_origin": it.get("country_of_origin"), "unit_weight_kg": it.get("unit_weight_kg"),
               "source": "booking"}
        try:
            existing = db.get_one("ts_products", sku=sku)
            if existing:
                db.update("ts_products", {"sku": sku}, {**row, "times_booked": existing["times_booked"] + 1,
                                                       "updated_at": datetime.now(timezone.utc).isoformat()})
            else:
                db.insert("ts_products", row)
        except Exception:
            pass


def _overlap(a: str, b: str) -> float:
    wa, wb = set(re.findall(r"[a-z]{3,}", a.lower())), set(re.findall(r"[a-z]{3,}", b.lower()))
    return len(wa & wb) / max(1, min(len(wa), len(wb)))


# ---------- issues for a list of items ----------

def item_issues(items: list[dict], judge: bool = True) -> list[dict]:
    """Reference-data problems per product, in the same shape as live_checks.Issue."""
    out = []
    known = catalogue([it.get("sku") for it in items])
    to_judge = {i: (it["description"], str(it.get("hs_code"))) for i, it in enumerate(items)
                if judge and it.get("description") and lookup(str(it.get("hs_code") or ""))}
    with ThreadPoolExecutor(max_workers=6) as pool:
        verdicts = dict(zip(to_judge, pool.map(lambda a: judge_match(*a), to_judge.values())))
    for i, it in enumerate(items):
        name = it.get("description") or it.get("sku") or f"product {i + 1}"
        if it.get("description"):
            for kind, _, msg in hs_match.suggest(it["description"], k=1):
                if kind == "VAGUE":
                    out.append({"key": f"DESC-vague:{i}", "rule_id": None, "severity": "Amber", "field": f"items.{i}.description",
                                "message": f"“{it['description']}” is too vague for customs — they need what the item is and what it’s made of.",
                                "fix": "Describe it plainly, e.g. “cotton t-shirt” or “ceramic coffee mug”.", "kind": "hs", "query": ""})
                elif kind == "RESTRICTED":
                    out.append({"key": f"DESC-restricted:{i}", "rule_id": None, "severity": "Red", "field": f"items.{i}.description",
                                "message": f"{name}: {msg}", "fix": "Check destination rules before booking, or remove it.", "kind": "hs", "query": ""})
        hs = str(it.get("hs_code") or "")
        if hs.isdigit() and len(hs) >= 6:
            info = lookup(hs)
            if not info:
                out.append({"key": f"HS-unknown:{i}", "rule_id": None, "severity": "Red", "field": f"items.{i}.hs_code",
                            "message": f"HS code “{hs}” for {name} doesn’t exist in the HS nomenclature.",
                            "fix": "Use the HS finder to look up the right 6-digit code.", "kind": "hs", "query": it.get("description") or ""})
            elif i in verdicts:
                v = verdicts[i]
                if v and v["fits"] == "no":
                    sug = v.get("suggestions") or []
                    codes = " or ".join(x["code"] for x in sug[:2])
                    fix = (f"Did you mean {codes}? Open the HS finder to compare." if sug
                           else "Open the HS finder to look up the right code for this product.")
                    out.append({"key": f"HS-mismatch:{i}", "rule_id": None, "severity": "Amber", "field": f"items.{i}.hs_code",
                                "message": f"HS {info['code']} is “{info['subheading']}” — that doesn’t look like {name}. {v.get('reason', '')}".strip(),
                                "fix": fix, "kind": "hs", "query": it.get("description"), "suggestions": sug})
        prev = known.get((it.get("sku") or "").strip())
        if prev:
            diffs = []
            if prev.get("hs_code") and hs and prev["hs_code"][:6] != hs[:6]:
                diffs.append(f"HS {prev['hs_code']}")
            if prev.get("description") and it.get("description") and _overlap(prev["description"], it["description"]) < 0.34:
                diffs.append(f"“{prev['description']}”")
            w0, w1 = prev.get("unit_weight_kg"), it.get("unit_weight_kg")
            try:
                if w0 and w1 and abs(float(w1) - float(w0)) / float(w0) > 0.2:
                    diffs.append(f"{float(w0):g} kg per unit")
            except (TypeError, ValueError):
                pass
            if diffs:
                out.append({"key": f"SKU-diff:{i}", "rule_id": None, "severity": "Amber", "field": f"items.{i}.sku",
                            "message": f"SKU {prev['sku']} is on record as {', '.join(diffs)}, which doesn’t match this entry.",
                            "fix": "Check whether the SKU or the product details are wrong.", "kind": "sku"})
    return out
