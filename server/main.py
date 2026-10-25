"""FastAPI app: chat booking, Excel upload, confirmations, help widget."""
import os
import secrets
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from . import db
from .agent import run_turn
from .carriers import CARRIERS
from .draft import apply_patch, draft_from_booking, empty_draft, missing_fields, missing_invoice_fields, try_build
from .evaluate import evaluate
from .excel import parse_workbook
from .invoice import build_invoice
from .live_checks import live_issues

app = FastAPI(title="Tuskers Shipment Booking")


def today_uk() -> date:
    return datetime.now(ZoneInfo("Europe/London")).date()


def new_reference() -> str:
    return f"TS-{today_uk():%y%m%d}-{secrets.token_hex(2).upper()}"


def _booking_row(report: dict, source: str, status: str, **extra) -> dict:
    chosen = report["recommendation"]["chosen"]
    return {
        "reference": new_reference(), "booking_id": report["booking"]["booking_id"], "source": source,
        "seller_name": report["booking"]["seller_name"], "status": status,
        "red_count": report["red_count"], "amber_count": report["amber_count"],
        "carrier": chosen["option"]["carrier"] + " · " + chosen["option"]["service"] if chosen else None,
        "total_cost": chosen["total_cost"] if chosen else None,
        "booking": report["booking"], "report": report, **extra,
    }


def snapshot(draft: dict) -> dict:
    """Everything the UI needs to show the current state of a draft."""
    today = today_uk()
    booking, build_error = try_build(draft)
    report = evaluate(booking, today) if booking else None
    return {
        "draft": draft,
        "missing": missing_fields(draft),
        "issues": [i.model_dump() for i in live_issues(draft, today)],
        "build_error": build_error,
        "report": report.model_dump(mode="json") if report else None,
        "invoice_missing": missing_invoice_fields(draft),
    }


@app.get("/api/health")
def health():
    return {"ok": True, "today": today_uk().isoformat(), "gemini": bool(os.environ.get("GEMINI_API_KEY"))}


@app.get("/api/carriers")
def carriers():
    return [c.model_dump(mode="json") | {"label": c.label} for c in CARRIERS]


def _load_or_create(conversation_id: Optional[str], prefix: str = "CHAT") -> dict:
    if conversation_id:
        conv = db.get_one("ts_conversations", id=conversation_id)
        if not conv:
            raise HTTPException(404, "Conversation not found")
        return conv
    conv = db.insert("ts_conversations", {"draft": empty_draft(), "history": []})[0]
    conv["draft"]["booking_id"] = f"{prefix}-" + conv["id"][:6].upper()
    return conv


def _save(conv_id: str, draft: dict, report: Optional[dict], history: Optional[list] = None):
    values = {"draft": draft, "report": report, "updated_at": datetime.utcnow().isoformat()}
    if history is not None:
        values["history"] = history
    db.update("ts_conversations", {"id": conv_id}, values)


# ---------- Part 1: conversation ----------

class ChatIn(BaseModel):
    conversation_id: Optional[str] = None
    message: str


@app.post("/api/chat")
def chat(body: ChatIn):
    conv = _load_or_create(body.conversation_id)
    draft, history = conv["draft"], conv["history"]

    try:
        out = run_turn(draft, history, body.message, today_uk())
    except Exception as e:  # Gemini/network failure: keep the conversation alive
        return {"conversation_id": conv["id"], "reply": f"Sorry, I couldn't read that just now ({type(e).__name__}). "
                "Please try sending it again.", "new_issues": [], "input_errors": [], "confirmed": None,
                **snapshot(draft)}

    draft = out["draft"]
    snap = snapshot(draft)
    history = history + [{"role": "user", "content": body.message}, {"role": "assistant", "content": out["reply"]}]
    reply, confirmed = out["reply"], None
    if out.get("confirm_requested"):
        if not snap["report"]:
            reply = "I can't confirm yet — the booking isn't complete. " + reply
        elif snap["report"]["blocked"]:
            reply = "I can't confirm yet — there are red problems to fix first. " + reply
        else:
            confirmed = _confirm(snap["report"], conv["id"], "chat")
            reply = _confirmed_text(confirmed)
            history[-1]["content"] = reply
    _save(conv["id"], draft, snap["report"], history)
    return {"conversation_id": conv["id"], "reply": reply, "new_issues": out.get("new_issues", []),
            "input_errors": out.get("input_errors", []), "confirmed": confirmed, **snap}


# ---------- Form: edit the draft directly ----------

class DraftIn(BaseModel):
    conversation_id: Optional[str] = None
    draft: dict


@app.post("/api/draft")
def update_draft(body: DraftIn):
    conv = _load_or_create(body.conversation_id, "FORM")
    base = conv["draft"]
    patch = {"booking": body.draft.get("booking") or {}, "items": body.draft.get("items") or [],
             "invoice": body.draft.get("invoice") or {}, "unknown": body.draft.get("unknown") or []}
    draft, errors, _ = apply_patch(base, patch, replace=True)
    snap = snapshot(draft)
    _save(conv["id"], draft, snap["report"])
    return {"conversation_id": conv["id"], "input_errors": errors, **snap}


@app.get("/api/bookings/{reference}/draft")
def booking_as_draft(reference: str):
    row = db.get_one("ts_bookings", reference=reference)
    if not row:
        raise HTTPException(404, "Booking not found")
    return {"draft": draft_from_booking(row["booking"])}


class InvoiceIn(BaseModel):
    conversation_id: str


@app.post("/api/invoice")
def invoice(body: InvoiceIn):
    conv = db.get_one("ts_conversations", id=body.conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    booking, err = try_build(conv["draft"])
    if not booking:
        raise HTTPException(400, err or "Complete the booking first")
    report = evaluate(booking, today_uk())
    return build_invoice(report, conv["draft"].get("invoice") or {}, today_uk())


def _confirm(report: dict, conversation_id: Optional[str], source: str) -> dict:
    return db.insert("ts_bookings", _booking_row(report, source, "confirmed", conversation_id=conversation_id))[0]


def _confirmed_text(row: dict) -> str:
    steps = "\n".join(f"• {s}" for s in row["report"]["next_steps"])
    return f"Confirmed. Your booking reference is {row['reference']}.\n{row['report']['confirmation']}\nWhat happens next:\n{steps}"


class ConfirmIn(BaseModel):
    conversation_id: str
    source: str = "chat"


@app.post("/api/chat/confirm")
def chat_confirm(body: ConfirmIn):
    conv = db.get_one("ts_conversations", id=body.conversation_id)
    if not conv or not conv.get("report"):
        raise HTTPException(400, "Booking is not complete yet")
    if conv["report"]["blocked"]:
        raise HTTPException(400, "Fix the red issues before confirming")
    row = _confirm(conv["report"], conv["id"], body.source if body.source in ("chat", "form") else "chat")
    return {"reference": row["reference"], "message": _confirmed_text(row)}


# ---------- Part 2: file upload ----------

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    data = await file.read()
    try:
        bookings, row_errors = parse_workbook(data)
    except Exception as e:
        raise HTTPException(400, f"Could not read the workbook: {e}")
    reports = [evaluate(b, today_uk()).model_dump(mode="json") for b in bookings]
    up = db.insert("ts_uploads", {"filename": file.filename, "booking_count": len(reports),
                                  "blocked_count": sum(r["blocked"] for r in reports),
                                  "row_errors": [e.model_dump() for e in row_errors]})[0]
    rows = db.insert("ts_bookings", [_booking_row(r, "upload", "on_hold" if r["blocked"] else "checked",
                                                  upload_id=up["id"]) for r in reports]) if reports else []
    for r, row in zip(reports, rows):
        r["reference"] = row["reference"]
    return {"upload_id": up["id"], "reports": reports, "row_errors": [e.model_dump() for e in row_errors]}


@app.post("/api/bookings/{reference}/confirm")
def confirm_uploaded(reference: str):
    row = db.get_one("ts_bookings", reference=reference)
    if not row:
        raise HTTPException(404, "Booking not found")
    if row["report"]["blocked"]:
        raise HTTPException(400, "Fix the red issues before confirming")
    db.update("ts_bookings", {"reference": reference}, {"status": "confirmed"})
    return {"reference": reference, "message": _confirmed_text(row)}


@app.get("/api/bookings")
def recent_bookings():
    return db.select("ts_bookings", {"select": "reference,booking_id,source,seller_name,status,red_count,"
                                               "amber_count,carrier,total_cost,created_at",
                                     "order": "created_at.desc", "limit": 20})


# ---------- Help widget ----------

HELP_PROMPT = """You are the help assistant inside a UK-to-EU shipment booking tool.
Explain shipping, customs and logistics terms (commercial invoice, HS code, declared value,
carton, pallet, customs hold, delivery appointment, transit time, gross vs net weight, country
of origin, dangerous goods) in plain English for small sellers, in under 120 words.
If asked about this tool: users can book by chatting or upload Bookings+Items sheets; red issues
block a shipment, amber issues are warnings; carriers are picked by the seller's priority.
Do not make up rates, rules or legal advice; for specific HS codes point to the UK Trade Tariff
(gov.uk/trade-tariff). Politely decline questions unrelated to shipping."""


class HelpIn(BaseModel):
    question: str
    context: Optional[str] = None


@app.post("/api/help")
def help_answer(body: HelpIn):
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    q = body.question if not body.context else f"(The user is looking at: {body.context})\n{body.question}"
    resp = client.models.generate_content(
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"), contents=q,
        config=types.GenerateContentConfig(system_instruction=HELP_PROMPT, temperature=0.3))
    return {"answer": resp.text}
