"""The booking draft shared by the chat and the form.

A draft is a plain dict: {"booking": {...}, "items": [...], "invoice": {...},
"unknown": [...], "derived": [...]}. Values are only accepted if they are in
the case's allowed lists; everything else is rejected with a message.
"""
import json
from typing import Any, Optional

from pydantic import ValidationError

from .schemas import (DESTINATION_CITIES, Booking, DestinationType, ItemOrigin, OriginCity,
                      Priority)

CITY_TO_COUNTRY = {city: country.value for country, cities in DESTINATION_CITIES.items() for city in cities}
ORIGIN_CITIES = [c.value for c in OriginCity]
DEST_CITIES = list(CITY_TO_COUNTRY)
ITEM_ORIGINS = [c.value for c in ItemOrigin]
PRIORITIES = [p.value for p in Priority]
DEST_TYPES = [d.value for d in DestinationType]
INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"]

BOOKING_FIELDS = ["seller_name", "origin_city", "destination_city", "destination_country",
                  "destination_type", "ready_to_ship_date", "seller_priority", "pallets", "cartons",
                  "total_declared_value", "total_gross_weight_kg", "delivery_appointment_booked"]
ITEM_FIELDS = ["sku", "description", "hs_code", "quantity", "unit_price", "units_per_carton",
               "cartons", "unit_weight_kg", "country_of_origin"]
# Allowed blank in Sheet 2; R-01 / R-09 flag them at evaluation.
OPTIONAL_ITEM_FIELDS = {"hs_code", "country_of_origin"}
INVOICE_FIELDS = ["seller_address", "seller_contact", "seller_eori", "buyer_name", "buyer_address",
                  "buyer_contact", "consignee_name", "consignee_address", "related_docs",
                  "payment_terms", "incoterms", "reason_for_export"]
INVOICE_REQUIRED = ["seller_address", "buyer_name", "buyer_address", "incoterms", "payment_terms"]

INT_FIELDS = {"pallets", "cartons", "quantity", "units_per_carton"}
NUM_FIELDS = {"total_declared_value", "total_gross_weight_kg", "unit_price", "unit_weight_kg"}

LABELS = {
    "seller_name": "Seller name", "origin_city": "Collection city", "destination_city": "Delivery city",
    "destination_country": "Delivery country", "destination_type": "Delivery site",
    "ready_to_ship_date": "Ready to ship", "seller_priority": "Priority", "pallets": "Pallets",
    "cartons": "Total cartons", "total_declared_value": "Declared value",
    "total_gross_weight_kg": "Gross weight", "delivery_appointment_booked": "Delivery appointment",
    "sku": "SKU", "description": "Description", "hs_code": "HS code", "quantity": "Quantity",
    "unit_price": "Unit price", "units_per_carton": "Units per carton", "unit_weight_kg": "Unit weight",
    "country_of_origin": "Country of origin",
    "seller_address": "Your address", "seller_contact": "Your contact", "seller_eori": "Your EORI number",
    "buyer_name": "Buyer name", "buyer_address": "Buyer address", "buyer_contact": "Buyer contact",
    "consignee_name": "Consignee", "consignee_address": "Consignee address",
    "related_docs": "PO / contract number", "payment_terms": "Payment terms", "incoterms": "Incoterms",
    "reason_for_export": "Reason for export",
}

ALIASES = {"uk": "United Kingdom", "england": "United Kingdom", "britain": "United Kingdom",
           "great britain": "United Kingdom", "gb": "United Kingdom", "holland": "Netherlands",
           "the netherlands": "Netherlands", "business": "Business address", "office": "Business address",
           "shop": "Business address", "store": "Business address", "fc": "Warehouse",
           "fulfilment centre": "Warehouse", "fulfillment center": "Warehouse",
           "reliable": "Most reliable", "cheap": "Cheapest", "fast": "Fastest", "quickest": "Fastest",
           "prc": "China", "turkiye": "Turkey", "türkiye": "Turkey", "viet nam": "Vietnam"}


def empty_draft() -> dict:
    return {"booking": {"origin_country": "United Kingdom", "currency": "GBP"},
            "items": [], "invoice": {}, "unknown": [], "derived": []}


def match(value: Any, options: list[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().lower()
    for o in options:
        if s == o.lower():
            return o
    a = ALIASES.get(s)
    return a if a in options else None


def _num(field: str, value: Any):
    """Coerce numbers; returns (value, error)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, None
    try:
        v = float(str(value).replace(",", "").replace("£", "").strip())
    except ValueError:
        return None, f"{LABELS[field]} must be a number, not “{value}”."
    if field in INT_FIELDS:
        if not v.is_integer():
            return None, f"{LABELS[field]} must be a whole number, not {value}."
        v = int(v)
    if v < 0:
        return None, f"{LABELS[field]} can't be negative."
    return v, None


def _clean_booking_value(b: dict, field: str, value: Any, errors: list[dict]):
    """Validate one booking field; returns (ok, value)."""
    def reject(msg):
        errors.append({"field": field, "message": msg})
        return False, None

    if field == "origin_city":
        m = match(value, ORIGIN_CITIES)
        return (True, m) if m else reject(f"We only collect from {', '.join(ORIGIN_CITIES)} — not “{value}”.")
    if field == "destination_city":
        m = match(value, DEST_CITIES)
        return (True, m) if m else reject(
            f"“{value}” isn't a delivery city we serve. Choose {', '.join(DEST_CITIES)}.")
    if field == "destination_country":
        m = match(value, ["Germany", "France", "Netherlands"])
        return (True, m) if m else reject(f"We only ship to Germany, France and the Netherlands — not “{value}”.")
    if field == "destination_type":
        m = match(value, DEST_TYPES)
        return (True, m) if m else reject("Delivery site must be a warehouse or a business address.")
    if field == "seller_priority":
        m = match(value, PRIORITIES)
        return (True, m) if m else reject("Priority must be cheapest, fastest, most reliable or balanced.")
    if field == "delivery_appointment_booked":
        if isinstance(value, bool):
            return True, value
        s = str(value).strip().lower()
        if s in ("yes", "y", "true", "booked"):
            return True, True
        if s in ("no", "n", "false", "not booked"):
            return True, False
        return reject("Delivery appointment must be yes or no.")
    if field == "ready_to_ship_date":
        from datetime import datetime
        try:
            d = datetime.strptime(str(value).strip(), "%d-%m-%Y")
        except ValueError:
            try:
                d = datetime.strptime(str(value).strip(), "%Y-%m-%d")
            except ValueError:
                return reject(f"“{value}” isn't a date I can read; use DD-MM-YYYY.")
        return True, d.strftime("%d-%m-%Y")
    if field in INT_FIELDS | NUM_FIELDS:
        v, err = _num(field, value)
        if err:
            return reject(err)
        if field == "pallets" and v is not None and v < 1:
            return reject("A shipment needs at least one pallet.")
        return True, v
    s = str(value).strip()
    return True, s or None


def _clean_item(it: dict, idx: int, errors: list[dict]) -> dict:
    out = {}
    for f in ITEM_FIELDS:
        v = it.get(f)
        if isinstance(v, str) and not v.strip():
            v = None
        if v is None:
            out[f] = None
            continue
        if f in INT_FIELDS | NUM_FIELDS:
            v, err = _num(f, v)
            if err:
                errors.append({"field": f"items.{idx}.{f}", "message": err})
        elif f == "country_of_origin":
            m = match(v, ITEM_ORIGINS)
            if not m:
                errors.append({"field": f"items.{idx}.{f}",
                               "message": f"“{v}” isn't an accepted country of origin; choose {', '.join(ITEM_ORIGINS)}."})
            v = m
        elif f == "hs_code":
            if isinstance(v, float) and v.is_integer():
                v = int(v)
            v = str(v).replace(".", "").replace(" ", "")
        else:
            v = str(v).strip()
        out[f] = v
    return out


def apply_patch(draft: dict, patch: dict, replace: bool = False) -> tuple[dict, list[dict], list[str]]:
    """Apply a patch to the draft. replace=True treats the patch as the whole
    booking (form edits, where a cleared field must clear). Returns
    (draft, input_errors, notes)."""
    draft = json.loads(json.dumps(draft))
    draft.setdefault("invoice", {})
    b = draft["booking"]
    errors: list[dict] = []
    notes: list[str] = []

    pb = patch.get("booking") or {}
    if replace:
        for f in BOOKING_FIELDS:
            if f not in pb or pb[f] in (None, ""):
                b.pop(f, None)
    for field, value in pb.items():
        if field not in BOOKING_FIELDS or value is None or value == "":
            continue
        ok, v = _clean_booking_value(b, field, value, errors)
        if not ok:
            continue
        if field in draft["derived"] and b.get(field) == v:
            continue  # form echoing back a worked-out total; keep it derived
        b[field] = v
        if field == "destination_city":
            b["destination_country"] = CITY_TO_COUNTRY[v]
        if field == "destination_country" and b.get("destination_city") and CITY_TO_COUNTRY[b["destination_city"]] != v:
            b.pop("destination_city")
        if field in ("cartons", "total_declared_value") and field in draft["derived"]:
            draft["derived"].remove(field)
    if replace:
        for f in ("cartons", "total_declared_value"):
            if f not in b and f in draft["derived"]:
                draft["derived"].remove(f)

    if patch.get("items") is not None:
        draft["items"] = [_clean_item(it, i, errors) for i, it in enumerate(patch["items"])]
    if replace:
        # Form: only fields the user explicitly marked "don't know" (and left blank) count as unknown.
        draft["unknown"] = [k for k in (patch.get("unknown") or [])
                            if k.count(".") == 2 and int(k.split(".")[1]) < len(draft["items"])
                            and draft["items"][int(k.split(".")[1])].get(k.split(".")[2]) is None]
    else:
        draft["unknown"] = sorted(set(draft.get("unknown", [])) | set(patch.get("unknown") or []))

    for field, value in (patch.get("invoice") or {}).items():
        if field not in INVOICE_FIELDS:
            continue
        if value in (None, ""):
            if replace:
                draft["invoice"].pop(field, None)
            continue
        if field == "incoterms":
            m = match(str(value).upper()[:3], INCOTERMS)
            if not m:
                errors.append({"field": "invoice.incoterms",
                               "message": f"“{value}” isn't an Incoterm; use one of {', '.join(INCOTERMS)} (DAP is common for road freight)."})
                continue
            value = m
        draft["invoice"][field] = str(value).strip()

    _derive(draft, notes)
    return draft, errors, notes


def _derive(draft: dict, notes: list[str]):
    b = draft["booking"]
    for idx, it in enumerate(draft["items"]):
        if not it.get("sku"):
            it["sku"] = f"ITEM-{idx + 1}"
        q, upc = it.get("quantity"), it.get("units_per_carton")
        if it.get("cartons") is None and q and upc and q % upc == 0:
            it["cartons"] = q // upc
            notes.append(f"Worked out {it['cartons']} cartons of {it.get('description') or it['sku']} "
                         f"({q} ÷ {upc} per carton).")
    if b.get("destination_type") == "Business address" and b.get("delivery_appointment_booked") is None:
        b["delivery_appointment_booked"] = False
    items_ready = draft["items"] and all(it.get(f) is not None for it in draft["items"]
                                         for f in ("quantity", "unit_price", "cartons"))
    if items_ready:
        for field, value in (("cartons", sum(it["cartons"] for it in draft["items"])),
                             ("total_declared_value", round(sum(it["quantity"] * it["unit_price"] for it in draft["items"]), 2))):
            if b.get(field) is None or field in draft["derived"]:
                b[field] = value
                if field not in draft["derived"]:
                    draft["derived"].append(field)


GROUPS = [
    ["seller_name"],
    ["origin_city", "destination_city", "destination_type"],
    "items",
    ["pallets", "total_gross_weight_kg"],
    ["ready_to_ship_date", "delivery_appointment_booked", "seller_priority"],
]


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


def missing_invoice_fields(draft: dict) -> list[str]:
    inv = draft.get("invoice") or {}
    return [f for f in INVOICE_REQUIRED if not inv.get(f)]


def build_booking(draft: dict) -> Booking:
    bid = draft.get("booking_id", "DRAFT")
    data = {**draft["booking"], "booking_id": bid,
            "items": [{**it, "booking_id": bid} for it in draft["items"]]}
    return Booking.model_validate(data)


def try_build(draft: dict) -> tuple[Optional[Booking], Optional[str]]:
    if missing_fields(draft):
        return None, None
    try:
        return build_booking(draft), None
    except ValidationError as e:
        return None, "; ".join(f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors())


def draft_from_booking(booking: dict) -> dict:
    """Load a checked booking (e.g. from an upload) into an editable draft."""
    d = empty_draft()
    d["booking_id"] = booking["booking_id"]
    for f in BOOKING_FIELDS:
        v = booking.get(f)
        if f == "ready_to_ship_date" and v and "-" in v and len(v.split("-")[0]) == 4:
            y, m, dd = v.split("-")
            v = f"{dd}-{m}-{y}"
        if v is not None:
            d["booking"][f] = v
    d["items"] = [{f: it.get(f) for f in ITEM_FIELDS} for it in booking.get("items", [])]
    d["unknown"] = [f"items.{i}.{f}" for i, it in enumerate(d["items"]) for f in OPTIONAL_ITEM_FIELDS if it.get(f) is None]
    return d
