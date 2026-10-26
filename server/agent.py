"""Conversational booking agent (LangGraph).

Graph: understand -> apply -> (answer) -> respond

- understand: Gemini reads the message in context and returns what the
              seller wants (give details, ask a question, confirm, get an
              invoice) plus a JSON patch of any details. It never invents values.
- apply:      deterministic. Validates against the allowed lists, derives
              safe totals, diffs the draft, runs live checks on partial data.
- answer_question: only for questions: a short plain-English answer (Gemini).
- respond:    deterministic reply: what changed, problems spotted right now
              (red/amber), the answer, then either the next missing details
              or the full pre-flight result.

Every turn re-runs the checks on the whole draft, so a mid-chat change
("add a pallet") immediately updates the flags, carrier and price.
"""
import json
import os
import time
from datetime import date
from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph

from .draft import (BOOKING_FIELDS, DEST_CITIES, GROUPS, INCOTERMS, ITEM_FIELDS, ITEM_ORIGINS, LABELS, ORIGIN_CITIES,
                    apply_patch, empty_draft, missing_fields, missing_invoice_fields, try_build)
from .evaluate import evaluate
from .invoice import invoice_question
from .live_checks import live_issues

__all__ = ["empty_draft", "run_turn", "missing_fields"]

ASK = {
    "seller_name": "your business name",
    "origin_city": f"where we collect from ({', '.join(ORIGIN_CITIES)})",
    "destination_city": f"the delivery city ({', '.join(DEST_CITIES)})",
    "destination_type": "whether it's going to a warehouse or a business address",
    "ready_to_ship_date": "the date the goods will be packed and ready for collection",
    "seller_priority": "what matters most: cheapest, fastest, most reliable, or a balance",
    "pallets": "how many pallets",
    "total_gross_weight_kg": "the total gross weight in kg (goods + cartons + pallets)",
    "delivery_appointment_booked": "whether you've booked a delivery appointment at the warehouse",
    "description": "what the product is",
    "quantity": "how many units",
    "unit_price": "the price per unit (GBP)",
    "units_per_carton": "how many units go in each carton",
    "cartons": "how many cartons",
    "unit_weight_kg": "the weight of one unit in kg",
    "hs_code": "the HS code (6+ digits, or say you don't know)",
    "country_of_origin": f"where it was made ({', '.join(ITEM_ORIGINS)})",
}
GROUP_INTRO = {
    "origin_city": "Now the route.",
    "pallets": "Next, how it's packed.",
    "ready_to_ship_date": "Nearly done.",
}


class AgentState(TypedDict, total=False):
    draft: dict
    history: list[dict]
    user_message: str
    today: str
    understood: dict
    old_draft: dict
    input_errors: list[dict]
    notes: list[str]
    issues: list[dict]
    new_issues: list[dict]
    resolved: list[str]
    missing: list[str]
    answer: Optional[str]
    reply: str
    report: Optional[dict]
    confirm_requested: bool


# ---------- understand (Gemini) ----------

UNDERSTAND_PROMPT = """You are the language-understanding step of a UK→EU pallet shipment booking assistant.
Read the seller's latest message in context and return ONLY JSON.

Today is {today}. Current booking draft (null = not known yet):
{draft}

Recent conversation:
{history}

Seller's new message: {message}

Return exactly:
{{
  "intent": one of "details" (gives or changes booking/invoice details), "question" (asks something),
            "confirm" (clearly approves/confirms the booking), "invoice" (wants a commercial invoice),
            "other" (greeting, thanks, unclear). A message can give details AND ask a question: use "question"
            and still fill the patch.,
  "question": the seller's question rewritten as a standalone question, or null,
  "booking": {{ only fields stated or changed in THIS message:
     seller_name, origin_city, destination_city, destination_country,
     destination_type ("Warehouse" | "Business address"),
     ready_to_ship_date ("DD-MM-YYYY"; resolve "next Friday", "5th Nov" etc. using today; with no year given use the current year, even if that date has passed),
     seller_priority ("Cheapest" | "Fastest" | "Most reliable" | "Balanced"),
     pallets (int), cartons (int — ONLY if the seller states a total for the whole shipment; per-product cartons go on the product),
     total_declared_value (number, GBP),
     total_gross_weight_kg (number), delivery_appointment_booked (true/false) }},
  "items": null if no product changed, else the FULL updated product list (keep existing products and values,
     apply additions, edits, removals). Product fields: sku, description, hs_code (digits as string),
     quantity, unit_price, units_per_carton, cartons, unit_weight_kg, country_of_origin. null if unknown.,
  "unknown": fields the seller says they don't know, as "items.<i>.hs_code" / "items.<i>.country_of_origin",
  "invoice": {{ only invoice details stated: seller_address, seller_contact, seller_eori, buyer_name,
     buyer_address, buyer_contact, consignee_name, consignee_address, related_docs (PO/contract no.),
     payment_terms, incoterms (one of {incoterms}), reason_for_export }}
}}

Rules:
- Never invent or calculate values the seller did not give (don't work out cartons, totals or weights).
- Copy place names exactly as written, even if they look wrong (we validate them).
- Relative changes apply to the draft: "add a pallet" with pallets=3 → 4; "make it 100 more mugs" → quantity + 100.
- A bare answer ("Leeds", "yes", "12") answers the last question the assistant asked.
- Units: grams→kg, tonnes→kg, pence→pounds. "half a kilo" = 0.5.
- "same as before"/"no change" → no patch.
- A business introducing itself ("Gadget Lane here", "this is Northfield Goods") sets seller_name. Only fill invoice
  addresses when the seller clearly gives a street address for invoicing.
"""


def _gemini(prompt: str, json_mode: bool = True, system: Optional[str] = None) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = types.GenerateContentConfig(temperature=0 if json_mode else 0.3, system_instruction=system,
                                         response_mime_type="application/json" if json_mode else None)
    for attempt in range(3):  # ride out brief rate limits / 5xx
        try:
            return client.models.generate_content(model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                                                  contents=prompt, config=config).text
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))


def understand(state: AgentState) -> AgentState:
    view = {k: v for k, v in state["draft"].items() if k in ("booking", "items", "invoice")}
    hist = "\n".join(f"{m['role']}: {m['content'][:400]}" for m in state.get("history", [])[-6:]) or "(none)"
    prompt = UNDERSTAND_PROMPT.format(today=state["today"], draft=json.dumps(view, default=str), history=hist,
                                      message=state["user_message"], incoterms=", ".join(INCOTERMS))
    return {"understood": json.loads(_gemini(prompt))}


# ---------- apply (deterministic) ----------

def _fmt(field: str, v) -> str:
    if v is None:
        return "—"
    if field in ("total_declared_value", "unit_price"):
        return f"£{v:,.2f}"
    if field in ("total_gross_weight_kg", "unit_weight_kg"):
        return f"{v:g} kg"
    if field == "delivery_appointment_booked":
        return "booked" if v else "not booked"
    return str(v)


ITEM_LABELS = {"description": "now", "hs_code": "HS", "quantity": "qty", "unit_price": "price",
               "units_per_carton": "per carton", "cartons": "cartons", "unit_weight_kg": "unit weight",
               "country_of_origin": "made in"}


def describe_changes(old: dict, new: dict) -> list[str]:
    out = []
    for f in BOOKING_FIELDS:
        if f == "destination_country":
            continue
        o, n = old["booking"].get(f), new["booking"].get(f)
        if n is not None and o != n and f not in new.get("derived", []):
            out.append(f"{LABELS[f].lower()} {_fmt(f, o)} → {_fmt(f, n)}" if o is not None else f"{LABELS[f].lower()} {_fmt(f, n)}")
    old_items, new_items = old["items"], new["items"]
    for i, it in enumerate(new_items):
        name = it.get("description") or it.get("sku")
        prev = old_items[i] if i < len(old_items) else None
        prev_name = (prev or {}).get("description") or ""
        swapped = prev and prev_name and name and prev_name.lower() not in name.lower() and name.lower() not in prev_name.lower()
        if prev is None or swapped:
            head = f"{it['quantity']} {name}" if it.get("quantity") is not None else name
            if it.get("unit_price") is not None:
                head += f" at £{it['unit_price']:,.2f}"
            out.append(f"replaced {prev_name} with {head}" if swapped else f"added {head}")
            continue
        changed = []
        for f in ITEM_FIELDS:
            if f in ("sku",) or it.get(f) is None or it.get(f) == prev.get(f):
                continue
            label = ITEM_LABELS[f]
            changed.append(f"{label} {_fmt(f, prev[f])} → {_fmt(f, it[f])}" if prev.get(f) is not None
                           else f"{label} {_fmt(f, it[f])}")
        if changed:
            out.append(f"{name}: {', '.join(changed)}")
    for it in old_items[len(new_items):]:
        out.append(f"removed {it.get('description') or it.get('sku')}")
    for f, v in (new.get("invoice") or {}).items():
        if (old.get("invoice") or {}).get(f) != v:
            out.append(f"{LABELS[f].lower()}: {v}")
    return out


def apply(state: AgentState) -> AgentState:
    u = state.get("understood") or {}
    old = state["draft"]
    draft, errors, notes = apply_patch(old, {"booking": u.get("booking"), "items": u.get("items"),
                                             "unknown": u.get("unknown"), "invoice": u.get("invoice")})
    if u.get("intent") == "invoice":
        draft["invoice_requested"] = True
    issues = [i.model_dump() for i in live_issues(draft, date.fromisoformat(state["today"]))]
    seen = set(old.get("issue_keys", []))
    new_issues = [i for i in issues if i["key"] not in seen and i["severity"] != "Info"]
    now = {i["key"] for i in issues}
    resolved = [k for k in seen if k not in now and not k.endswith("-info")]
    draft["issue_keys"] = [i["key"] for i in issues]
    return {"draft": draft, "old_draft": old, "input_errors": errors, "notes": notes, "issues": issues,
            "new_issues": new_issues, "resolved": resolved, "missing": missing_fields(draft),
            "confirm_requested": u.get("intent") == "confirm"}


# ---------- answer (Gemini, questions only) ----------

ANSWER_SYSTEM = """You answer a small UK seller's question inside a pallet booking chat (UK → Germany,
France, Netherlands by road). Be accurate and brief: 2–4 sentences, plain English, no headings.
You may use the booking draft for context. Never make up prices, rules or legal advice; for HS codes
point to the UK Trade Tariff (gov.uk/trade-tariff). If the question is off-topic, say you can only help
with shipping and this booking."""


def answer(state: AgentState) -> AgentState:
    q = state["understood"].get("question") or state["user_message"]
    view = {k: state["draft"][k] for k in ("booking", "items")}
    try:
        text = _gemini(f"Booking draft: {json.dumps(view, default=str)}\n\nQuestion: {q}", json_mode=False,
                       system=ANSWER_SYSTEM).strip()
    except Exception:
        text = "Sorry, I couldn't look that up just now — the Help button has explanations of common terms."
    return {"answer": text}


# ---------- respond (deterministic) ----------

def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def next_question(draft: dict, missing: list[str]) -> str:
    first = missing[0]
    if first == "items":
        return ("What are you sending? For each product: what it is, how many units, price per unit, "
                "units per carton and the weight of one unit. HS code and country of origin too, if you have them.")
    if first.startswith("items."):
        idx = int(first.split(".")[1])
        fields = [m.split(".")[2] for m in missing if m.startswith(f"items.{idx}.")]
        name = draft["items"][idx].get("description") or f"product {idx + 1}"
        return f"For the {name}, I still need {_join([ASK[f] for f in fields])}."
    group = next(g for g in GROUPS if g != "items" and first in g)
    wanted = [ASK[f] for f in group if f in missing]
    intro = GROUP_INTRO.get(group[0], "")
    return f"{intro} Could you tell me {_join(wanted)}?".strip()


def respond(state: AgentState) -> AgentState:
    draft, u = state["draft"], state.get("understood") or {}
    lines: list[str] = []
    changes = describe_changes(state["old_draft"], draft)
    if changes:
        lines.append("Got it — " + "; ".join(changes) + ".")
    lines += state.get("notes", [])
    if state.get("answer"):
        lines.append(state["answer"])
    if not changes and not state.get("answer") and not state.get("input_errors") and u.get("intent") in ("other", "details", None):
        lines.append("I didn't pick up any booking details there." if u.get("intent") == "details" else "Happy to help.")
    if state.get("resolved"):
        lines.append(f"✓ That clears {len(state['resolved'])} earlier problem(s).")
    for e in state.get("input_errors", []):
        lines.append("✗ " + e["message"])
    if state["new_issues"]:
        reds = sum(i["severity"] == "Red" for i in state["new_issues"])
        lines.append(f"I've flagged {len(state['new_issues'])} problem(s) with what you've told me"
                     + (f" — {reds} would stop the shipment." if reds else ".") + " Details below.")

    report = None
    if state["missing"]:
        lines.append(next_question(draft, state["missing"]))
    else:
        booking, err = try_build(draft)
        if err:
            lines.append(f"Something doesn't add up: {err}. Could you correct it?")
        else:
            rep = evaluate(booking, date.fromisoformat(state["today"]))
            report = rep.model_dump(mode="json")
            totals = {"cartons": f"{booking.cartons} cartons",
                      "total_declared_value": f"a declared value of £{booking.total_declared_value:,.2f}"}
            derived = [totals[f] for f in draft.get("derived", []) if f in totals]
            if derived and not draft.get("derived_announced"):
                draft["derived_announced"] = True
                lines.append(f"From your products I've taken {_join(derived)} — tell me if your paperwork says otherwise.")
            booking_changed = (state["old_draft"]["booking"], state["old_draft"]["items"]) != (draft["booking"], draft["items"])
            if not state["old_draft"].get("report_shown") or booking_changed:
                lines.append(rep.confirmation)
            draft["report_shown"] = True
            inv_missing = missing_invoice_fields(draft)
            if rep.blocked:
                lines.append("Tell me the corrected details and I'll re-check straight away.")
            elif draft.get("invoice_requested") and inv_missing:
                lines.append(invoice_question(inv_missing))
            elif draft.get("invoice_requested"):
                lines.append("Your commercial invoice is ready — open it from the panel on the right. "
                             "Reply “confirm” to book.")
            else:
                lines.append("Reply “confirm” (or press Confirm) to book. I can also prepare the commercial invoice — just ask.")
    return {"draft": draft, "reply": "\n".join(lines), "report": report}


def _after_apply(state: AgentState) -> str:
    return "answer_question" if (state.get("understood") or {}).get("intent") == "question" else "respond"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("understand", understand)
    g.add_node("apply", apply)
    g.add_node("answer_question", answer)
    g.add_node("respond", respond)
    g.set_entry_point("understand")
    g.add_edge("understand", "apply")
    g.add_conditional_edges("apply", _after_apply, {"answer_question": "answer_question", "respond": "respond"})
    g.add_edge("answer_question", "respond")
    g.add_edge("respond", END)
    return g.compile()


GRAPH = build_graph()


def run_turn(draft: dict, history: list[dict], message: str, today: Optional[date] = None) -> AgentState:
    return GRAPH.invoke({"draft": draft, "history": history, "user_message": message,
                         "today": (today or date.today()).isoformat()})
