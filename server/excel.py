"""Read the judges' workbook (Sheet 1 Bookings + Sheet 2 Items).

Headers are matched loosely (case, spacing, units in brackets) so small
wording differences in the template don't break parsing.
"""
import io
import re
from typing import Any, Optional

from openpyxl import load_workbook
from pydantic import BaseModel, ValidationError

from .schemas import Booking

BOOKING_COLS = {
    "bookingid": "booking_id", "sellername": "seller_name", "origincity": "origin_city",
    "origincountry": "origin_country", "destinationcity": "destination_city",
    "destinationcountry": "destination_country", "destinationtype": "destination_type",
    "readytoshipdate": "ready_to_ship_date", "sellerpriority": "seller_priority",
    "pallets": "pallets", "cartons": "cartons", "totaldeclaredvalue": "total_declared_value",
    "currency": "currency", "totalgrossweight": "total_gross_weight_kg",
    "deliveryappointmentbooked": "delivery_appointment_booked",
}
ITEM_COLS = {
    "bookingid": "booking_id", "sku": "sku", "description": "description", "hscode": "hs_code",
    "quantity": "quantity", "unitprice": "unit_price", "unitspercarton": "units_per_carton",
    "cartons": "cartons", "unitweight": "unit_weight_kg", "countryoforigin": "country_of_origin",
}


# Row 3 of the template is a grey example. Judges enter data from row 4, so
# skip that row only if it is left in exactly as shipped.
EXAMPLE_ROWS = {
    ("BK-001", "Northfield Goods", "Manchester", "United Kingdom", "Frankfurt", "Germany", "Warehouse",
     "05-11-2026", "Cheapest", "3", "90", "5400", "GBP", "620", "Yes"),
    ("BK-001", "MUG-01", "Ceramic coffee mug, 350 ml", "691200", "1080", "5", "12", "90", "0.5", "United Kingdom"),
}


def _is_example(row) -> bool:
    def norm(v):
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        return str(v).strip() if v is not None else ""
    return tuple(norm(v) for v in row if v is not None) in EXAMPLE_ROWS


class RowError(BaseModel):
    booking_id: str
    errors: list[str]


def _norm(h: Any) -> str:
    h = re.sub(r"\(.*?\)", "", str(h or "")).lower()
    return re.sub(r"[^a-z]", "", h)


def _rows(ws, colmap: dict[str, str]) -> list[dict]:
    rows = ws.iter_rows(values_only=True)
    header_idx: Optional[dict[int, str]] = None
    out = []
    for row in rows:
        if header_idx is not None and _is_example(row):
            continue
        if header_idx is None:
            found = {i: colmap[_norm(c)] for i, c in enumerate(row) if _norm(c) in colmap}
            if "booking_id" in found.values() and len(found) >= 3:
                header_idx = found
            continue
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        out.append({field: row[i] for i, field in header_idx.items() if i < len(row)})
    if header_idx is None:
        raise ValueError(f"Could not find a header row with 'Booking ID' in sheet {ws.title!r}")
    return out


def _sheet(wb, name: str, fallback: int):
    for ws in wb.worksheets:
        if name in ws.title.lower():
            return ws
    return wb.worksheets[fallback]


def _fmt(e: ValidationError) -> list[str]:
    msgs = []
    for err in e.errors():
        loc = ".".join(str(p) for p in err["loc"])
        msgs.append(f"{loc}: {err['msg']}" if loc else err["msg"])
    return msgs


def parse_workbook(data: bytes) -> tuple[list[Booking], list[RowError]]:
    wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    bookings_raw = _rows(_sheet(wb, "booking", 0), BOOKING_COLS)
    items_raw = _rows(_sheet(wb, "item", 1), ITEM_COLS)

    by_booking: dict[str, list[dict]] = {}
    for it in items_raw:
        by_booking.setdefault(str(it.get("booking_id", "")).strip(), []).append(it)

    bookings, errors = [], []
    for raw in bookings_raw:
        bid = str(raw.get("booking_id", "")).strip()
        raw["items"] = by_booking.get(bid, [])
        try:
            b = Booking.model_validate(raw)
        except ValidationError as e:
            errors.append(RowError(booking_id=bid or "?", errors=_fmt(e)))
            continue
        if not b.items:
            errors.append(RowError(booking_id=bid, errors=["No items found for this booking in the Items sheet"]))
            continue
        bookings.append(b)
    return bookings, errors
