"""Conversational booking agent (LangGraph).

Graph: extract -> normalise -> (ask | evaluate)

- extract:   Gemini turns the seller's message into a JSON patch on the draft.
             It never answers questions or invents values.
- normalise: deterministic. Rejects values outside the allowed lists, fills
             safe derivations (country from city, cartons from units), and
             works out which required fields are still missing.
- ask:       deterministic question for the next group of missing fields.
- evaluate:  builds the Booking, runs the rulebook + carrier recommender.

Every turn re-runs the whole graph on the updated draft, so a mid-chat
change ("add a pallet") always re-runs the checks and carrier choice.
"""
import json
import os
from datetime import date
from typing import Any, Optional, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import ValidationError

from .evaluate import evaluate
from .schemas import (DESTINATION_CITIES, Booking, DestinationType, ItemOrigin, OriginCity,
                      Priority)

CITY_TO_COUNTRY = {city: country.value for country, cities in DESTINATION_CITIES.items() for city in cities}
ORIGIN_CITIES = [c.value for c in OriginCity]
ITEM_ORIGINS = [c.value for c in ItemOrigin]
PRIORITIES = [p.value for p in Priority]
DEST_TYPES = [d.value for d in DestinationType]

BOOKING_FIELDS = ["seller_name", "origin_city", "destination_city", "destination_country",
                  "destination_type", "ready_to_ship_date", "seller_priority", "pallets", "cartons",
                  "total_declared_value", "total_gross_weight_kg", "delivery_appointment_booked"]
ITEM_FIELDS = ["sku", "description", "hs_code", "quantity", "unit_price", "units_per_carton",
               "cartons", "unit_weight_kg", "country_of_origin"]
# Allowed blank in Sheet 2; we ask once, and "don't know" leaves them blank for R-01/R-09 to flag.
OPTIONAL_ITEM_FIELDS = {"hs_code", "country_of_origin"}

LABELS = {
    "seller_name": "your business name",
    "origin_city": f"the collection city ({', '.join(ORIGIN_CITIES)})",
    "destination_city": "the delivery city (Berlin, Frankfurt, Hamburg, Paris, Lyon, Amsterdam or Rotterdam)",
    "destination_type": "whether it's going to a warehouse or a business address",
    "ready_to_ship_date": "the date the goods will be packed and ready for collection",
    "seller_priority": "what matters most: cheapest, fastest, most reliable, or balanced",
    "pallets": "how many pallets",
    "total_gross_weight_kg": "the total gross weight in kg (goods + cartons + pallets)",
    "delivery_appointment_booked": "whether you have a delivery appointment booked at the warehouse",
    "description": "what the product is",
    "quantity": "how many units",
    "unit_price": "the price per unit in GBP",
    "units_per_carton": "how many units go in each carton",
    "cartons": "how many cartons",
    "unit_weight_kg": "the weight of one unit in kg",
    "hs_code": "the HS code (6+ digits; say 'don't know' if you don't have it)",
    "country_of_origin": f"where it was made ({', '.join(ITEM_ORIGINS)})",
}

GROUPS = [
    ["seller_name"],
    ["origin_city", "destination_city", "destination_type"],
    "items",
    ["pallets", "total_gross_weight_kg"],
    ["ready_to_ship_date", "delivery_appointment_booked", "seller_priority"],
]


class AgentState(TypedDict, total=False):
    draft: dict
    history: list[dict]
    user_message: str
    today: str
    patch: dict
    notes: list[str]
    missing: list[str]
    reply: str
    report: Optional[dict]
    confirm_requested: bool


def empty_draft() -> dict:
    return {"booking": {"origin_country": "United Kingdom", "currency": "GBP"},
            "items": [], "unknown": [], "derived": []}


# ---------- extract (Gemini) ----------

EXTRACT_PROMPT = """You extract shipment booking data from a seller's chat message.
Return ONLY JSON. Never invent values the seller did not give, and never calculate missing
values yourself (e.g. do not work out cartons from units). Never answer questions.

Today is {today}. Current draft (null = not yet known):
{draft}

Last question we asked the seller: {last_question}
Seller's new message: {message}

Return:
{{
  "booking": {{ only fields the seller stated or changed in THIS message, from:
     seller_name (text), origin_city, destination_city, destination_type ("Warehouse" or "Business address"),
     ready_to_ship_date ("DD-MM-YYYY"; resolve relative dates like "next Friday" using today),
     seller_priority ("Cheapest"|"Fastest"|"Most reliable"|"Balanced"),
     pallets (int), cartons (int, booking total), total_declared_value (number, GBP),
     total_gross_weight_kg (number), delivery_appointment_booked (true/false) }},
  "items": null if no item changed, otherwise the FULL updated list of items (keep every existing
     item and its values, apply additions/edits/removals). Item fields: sku, description, hs_code (string of digits),
     quantity (int), unit_price (number), units_per_carton (int), cartons (int), unit_weight_kg (number),
     country_of_origin. Use null for anything unknown.,
  "unknown": list of fields the seller says they do not know, as "items.<index>.hs_code" or
     "items.<index>.country_of_origin",
  "confirm": true only if the seller is clearly confirming/approving the booking
}}

Rules:
- Relative changes apply to the draft: "add a pallet" with pallets=3 -> pallets 4; "one more carton of mugs" updates that item.
- Convert units: grams -> kg, tonnes -> kg. Prices in pence -> pounds.
- Copy city/country names as the seller wrote them (we validate them ourselves).
- If the answer is a bare value, map it to the last question we asked.
"""


def _gemini_json(prompt: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
    )
    return json.loads(resp.text)


def extract(state: AgentState) -> AgentState:
    last_q = next((m["content"] for m in reversed(state.get("history", [])) if m["role"] == "assistant"), "none")
    prompt = EXTRACT_PROMPT.format(today=state["today"], draft=json.dumps(state["draft"], default=str),
                                   last_question=last_q, message=state["user_message"])
    return {"patch": _gemini_json(prompt)}


# ---------- normalise (deterministic) ----------

def _match(value: Any, options: list[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().lower()
    for o in options:
        if s == o.lower():
            return o
    aliases = {"uk": "United Kingdom", "england": "United Kingdom", "britain": "United Kingdom",
               "great britain": "United Kingdom", "holland": "Netherlands", "the netherlands": "Netherlands",
               "business": "Business address", "office": "Business address", "shop": "Business address",
               "reliable": "Most reliable", "cheap": "Cheapest", "fast": "Fastest", "quickest": "Fastest"}
    a = aliases.get(s)
    return a if a in options else None


def normalise(state: AgentState) -> AgentState:
    draft = json.loads(json.dumps(state["draft"]))
    patch = state.get("patch") or {}
    notes: list[str] = []
    b = draft["booking"]

    for field, value in (patch.get("booking") or {}).items():
        if field not in BOOKING_FIELDS or value is None:
            continue
        if field == "origin_city":
            m = _match(value, ORIGIN_CITIES)
            if not m:
                notes.append(f"Sorry, we only collect from {', '.join(ORIGIN_CITIES)} — not “{value}”.")
                continue
            value = m
        elif field == "destination_city":
            m = _match(value, list(CITY_TO_COUNTRY))
            if not m:
                notes.append(f"Sorry, “{value}” isn't a delivery city we serve. "
                             "Choose Berlin, Frankfurt, Hamburg, Paris, Lyon, Amsterdam or Rotterdam.")
                continue
            value = m
            b["destination_country"] = CITY_TO_COUNTRY[m]
        elif field == "destination_country":
            m = _match(value, ["Germany", "France", "Netherlands"])
            if not m:
                notes.append(f"Sorry, we only ship to Germany, France and the Netherlands — not “{value}”.")
                continue
            if b.get("destination_city") and CITY_TO_COUNTRY.get(b["destination_city"]) != m:
                b.pop("destination_city")
            value = m
        elif field == "destination_type":
            value = _match(value, DEST_TYPES)
            if not value:
                continue
        elif field == "seller_priority":
            value = _match(value, PRIORITIES)
            if not value:
                notes.append("Please pick a priority: cheapest, fastest, most reliable or balanced.")
                continue
        elif field in ("pallets", "cartons"):
            try:
                value = int(value)
            except (TypeError, ValueError):
                continue
            if field == "pallets" and value < 1:
                notes.append("A shipment needs at least one pallet.")
                continue
        b[field] = value
        if field in ("cartons", "total_declared_value"):
            draft["derived"] = [d for d in draft["derived"] if d != field]

    if patch.get("items") is not None:
        new_items = []
        for i, it in enumerate(patch["items"]):
            it = {k: it.get(k) for k in ITEM_FIELDS}
            if it.get("country_of_origin") is not None:
                m = _match(it["country_of_origin"], ITEM_ORIGINS)
                if not m:
                    notes.append(f"“{it['country_of_origin']}” isn't an accepted country of origin; "
                                 f"choose {', '.join(ITEM_ORIGINS)}.")
                it["country_of_origin"] = m
            if it.get("hs_code") is not None:
                it["hs_code"] = str(it["hs_code"]).replace(".", "").replace(" ", "")
            new_items.append(it)
        draft["items"] = new_items
    draft["unknown"] = sorted(set(draft.get("unknown", [])) | set(patch.get("unknown") or []))

    # Safe derivations, each announced so the seller can correct them.
    for idx, it in enumerate(draft["items"]):
        if not it.get("sku"):
            it["sku"] = f"ITEM-{idx + 1}"
        q, upc = it.get("quantity"), it.get("units_per_carton")
        if it.get("cartons") is None and q and upc and q % upc == 0:
            it["cartons"] = q // upc
            notes.append(f"Worked out {it['cartons']} cartons of {it.get('description') or it['sku']} "
                         f"({q} units ÷ {upc} per carton).")
    if b.get("destination_type") == "Business address" and b.get("delivery_appointment_booked") is None:
        b["delivery_appointment_booked"] = False
    items_complete = draft["items"] and all(it.get(f) is not None for it in draft["items"]
                                            for f in ("quantity", "unit_price", "cartons"))
    if items_complete:
        if b.get("cartons") is None or "cartons" in draft["derived"]:
            b["cartons"] = sum(it["cartons"] for it in draft["items"])
            if "cartons" not in draft["derived"]:
                draft["derived"].append("cartons")
        if b.get("total_declared_value") is None or "total_declared_value" in draft["derived"]:
            b["total_declared_value"] = round(sum(it["quantity"] * it["unit_price"] for it in draft["items"]), 2)
            if "total_declared_value" not in draft["derived"]:
                draft["derived"].append("total_declared_value")

    return {"draft": draft, "notes": notes, "missing": missing_fields(draft),
            "confirm_requested": bool(patch.get("confirm"))}


def missing_fields(draft: dict) -> list[str]:
    b, missing = draft["booking"], []
    for group in GROUPS:
        if group == "items":
            if not draft["items"]:
                missing.append("items")
            for i, it in enumerate(draft["items"]):
                for f in ITEM_FIELDS:
                    if it.get(f) is None and not (f in OPTIONAL_ITEM_FIELDS and f"items.{i}.{f}" in draft["unknown"]):
                        missing.append(f"items.{i}.{f}")
        else:
            missing += [f for f in group if b.get(f) is None]
    return missing


# ---------- ask / evaluate ----------

def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def ask(state: AgentState) -> AgentState:
    missing, draft = state["missing"], state["draft"]
    first = missing[0]
    if first == "items":
        q = ("What are you shipping? For each product tell me what it is, how many units, the price per unit (GBP), "
             "units per carton, and the weight of one unit. HS code and country of origin help too.")
    elif first.startswith("items."):
        idx = int(first.split(".")[1])
        fields = [m.split(".")[2] for m in missing if m.startswith(f"items.{idx}.")]
        name = draft["items"][idx].get("description") or f"item {idx + 1}"
        q = f"For {name}, I still need {_join([LABELS[f] for f in fields])}."
    else:
        group = next(g for g in GROUPS if g != "items" and first in g)
        q = f"Could you tell me {_join([LABELS[f] for f in group if f in missing])}?"
    return {"reply": "\n".join(state.get("notes", []) + [q]), "report": None}


def build_booking(draft: dict, booking_id: str = "CHAT-DRAFT") -> Booking:
    data = dict(draft["booking"])
    data["booking_id"] = booking_id
    data["items"] = [{**it, "booking_id": booking_id} for it in draft["items"]]
    return Booking.model_validate(data)


def evaluate_node(state: AgentState) -> AgentState:
    draft = state["draft"]
    try:
        booking = build_booking(draft, draft.get("booking_id", "CHAT-DRAFT"))
    except ValidationError as e:
        msgs = "; ".join(f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors())
        return {"reply": "\n".join(state.get("notes", []) + [f"Something doesn't look right: {msgs}. Could you correct it?"]),
                "report": None}
    report = evaluate(booking, date.fromisoformat(state["today"]))
    derived = []
    if "cartons" in draft["derived"]:
        derived.append(f"{booking.cartons} cartons in total")
    if "total_declared_value" in draft["derived"]:
        derived.append(f"a declared value of £{booking.total_declared_value:,.2f}")
    lines = list(state.get("notes", []))
    if derived and not draft.get("derived_announced"):
        draft["derived_announced"] = True
        lines.append(f"From your items I've taken {_join(derived)} — tell me if your paperwork says otherwise.")
    lines.append(report.confirmation)
    if report.blocked:
        lines.append("See the checks panel for what to fix. Tell me the corrected details and I'll re-check.")
    else:
        lines.append("Reply “confirm” or press Confirm booking to lock it in. You can still change any detail.")
    return {"reply": "\n".join(lines), "report": report.model_dump(mode="json")}


def _route(state: AgentState) -> str:
    return "ask" if state["missing"] else "evaluate"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("extract", extract)
    g.add_node("normalise", normalise)
    g.add_node("ask", ask)
    g.add_node("evaluate", evaluate_node)
    g.set_entry_point("extract")
    g.add_edge("extract", "normalise")
    g.add_conditional_edges("normalise", _route, {"ask": "ask", "evaluate": "evaluate"})
    g.add_edge("ask", END)
    g.add_edge("evaluate", END)
    return g.compile()


GRAPH = build_graph()


def run_turn(draft: dict, history: list[dict], message: str, today: Optional[date] = None) -> AgentState:
    return GRAPH.invoke({"draft": draft, "history": history, "user_message": message,
                         "today": (today or date.today()).isoformat()})
