"""Checks on a partial draft, run after every chat message or form edit.

Each rule from the rulebook is checked as soon as the data it needs exists,
so a short HS code or a lithium battery is flagged the moment it's
mentioned, not after the whole booking is filled in. Sanity checks catch
values that are allowed but implausible (a 0 kg unit, a 2-tonne pallet).
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from .carriers import carriers_for
from .rulebook import VALUE_TOLERANCE, dangerous_category, possible_dangerous
from .schemas import DestinationCountry


class Issue(BaseModel):
    key: str                 # stable id, e.g. "R-03:items.0"
    rule_id: Optional[str]   # rulebook id, or None for sanity / input problems
    severity: str            # "Red" | "Amber" | "Info"
    field: str               # draft path the issue points at, e.g. "items.0.cartons"
    message: str
    fix: Optional[str] = None


def _name(it: dict, i: int) -> str:
    return it.get("description") or it.get("sku") or f"item {i + 1}"


def _date(s) -> Optional[date]:
    try:
        return datetime.strptime(s, "%d-%m-%Y").date()
    except (TypeError, ValueError):
        return None


def live_issues(draft: dict, today: date) -> list[Issue]:
    b, items, unknown = draft["booking"], draft["items"], set(draft.get("unknown", []))
    out: list[Issue] = []

    def add(key, rule_id, sev, field, msg, fix=None):
        out.append(Issue(key=key, rule_id=rule_id, severity=sev, field=field, message=msg, fix=fix))

    for i, it in enumerate(items):
        n = _name(it, i)
        hs = it.get("hs_code")
        if hs is not None and not (hs.isdigit() and len(hs) >= 6):
            add(f"R-01:{i}", "R-01", "Red", f"items.{i}.hs_code",
                f"HS code “{hs}” for {n} is too short or not numeric — customs needs at least 6 digits.",
                "Look the product up in the UK Trade Tariff (gov.uk/trade-tariff) and use the full code.")
        elif hs is None and f"items.{i}.hs_code" in unknown:
            add(f"R-01:{i}", "R-01", "Red", f"items.{i}.hs_code",
                f"No HS code for {n}. Customs can hold the shipment without one.",
                "Find it in the UK Trade Tariff (gov.uk/trade-tariff) before collection.")

        q, upc, c = it.get("quantity"), it.get("units_per_carton"), it.get("cartons")
        if None not in (q, upc, c) and upc * c != q:
            add(f"R-03:{i}", "R-03", "Red", f"items.{i}.cartons",
                f"{n}: {c} cartons × {upc} per carton = {upc * c} units, but you said {q}.",
                f"Either {q} units need {q / upc:g} cartons, or the quantity is {upc * c}.")
        elif q is not None and upc and c is None and q % upc:
            add(f"S-split:{i}", None, "Amber", f"items.{i}.units_per_carton",
                f"{q} units don't divide evenly into cartons of {upc} ({q / upc:.1f} cartons).",
                "Check the pack size — the warehouse counts full cartons.")
        if upc and q is not None and upc > q > 0:
            add(f"S-upc:{i}", None, "Amber", f"items.{i}.units_per_carton",
                f"{n}: {upc} per carton is more than the {q} units you're sending.")

        text = f"{it.get('sku') or ''} {it.get('description') or ''}"
        category = dangerous_category(text)
        if category:
            add(f"R-06:{i}", "R-06", "Red", f"items.{i}.description",
                f"{n} looks like a {category}, which these road services can't carry.",
                "Remove it from this booking and ship it with a dangerous-goods specialist.")
        elif possible_dangerous(text):
            add(f"S-dg:{i}", None, "Amber", f"items.{i}.description",
                f"{n} may be dangerous goods: {possible_dangerous(text)}.",
                "Check the product's safety data sheet before booking.")

        if it.get("country_of_origin") is None and f"items.{i}.country_of_origin" in unknown:
            add(f"R-09:{i}", "R-09", "Amber", f"items.{i}.country_of_origin",
                f"No country of origin for {n}; customs uses it to set duty.",
                "Add where it was made (not where it ships from).")

        w = it.get("unit_weight_kg")
        if w is not None and w == 0:
            add(f"S-w0:{i}", None, "Red", f"items.{i}.unit_weight_kg", f"{n} can't weigh 0 kg.", "Enter the weight of one unit.")
        elif w is not None and w > 500:
            add(f"S-wbig:{i}", None, "Amber", f"items.{i}.unit_weight_kg",
                f"{w:g} kg per unit is very heavy for {n} — is that the carton or total weight?",
                "Unit weight is for one single unit.")
        p = it.get("unit_price")
        if p is not None and p == 0:
            add(f"S-p0:{i}", None, "Amber", f"items.{i}.unit_price",
                f"{n} is priced at £0. Customs still needs a realistic value, even for free samples.")
        if q is not None and q == 0:
            add(f"S-q0:{i}", None, "Red", f"items.{i}.quantity", f"Quantity for {n} is 0.", "Enter how many units you're sending.")

    complete_items = items and all(it.get(f) is not None for it in items for f in ("quantity", "unit_price", "cartons"))
    if complete_items and b.get("total_declared_value") is not None and "total_declared_value" not in draft.get("derived", []):
        expected = sum(it["quantity"] * it["unit_price"] for it in items)
        if abs(b["total_declared_value"] - expected) > VALUE_TOLERANCE * expected:
            add("R-02", "R-02", "Red", "total_declared_value",
                f"Declared value £{b['total_declared_value']:,.2f} doesn't match the items (£{expected:,.2f}).",
                f"Use £{expected:,.2f}, or correct the item prices/quantities.")
    if complete_items and b.get("cartons") is not None and "cartons" not in draft.get("derived", []):
        total = sum(it["cartons"] for it in items)
        if total != b["cartons"]:
            add("R-04", "R-04", "Red", "cartons",
                f"You said {b['cartons']} cartons in total, but the items add up to {total}.",
                f"Use {total}, or fix the item carton counts.")

    gross, pallets = b.get("total_gross_weight_kg"), b.get("pallets")
    if gross is not None and pallets:
        per = gross / pallets
        if b.get("destination_country"):
            route = carriers_for(DestinationCountry(b["destination_country"]))
            fits = [c for c in route if c.max_weight_per_pallet_kg >= per]
            if not fits:
                biggest = max(c.max_weight_per_pallet_kg for c in route)
                need = -(-gross // biggest)
                add("R-05", "R-05", "Red", "pallets",
                    f"{per:,.0f} kg per pallet is over every carrier's limit to {b['destination_country']} (max {biggest:,.0f} kg).",
                    f"Spread it over at least {int(need)} pallets.")
            elif len(fits) < len(route):
                add("R-05-info", None, "Info", "pallets",
                    f"At {per:,.0f} kg per pallet only {', '.join(c.label for c in fits)} can take it.")
        if per > 1500:
            add("S-pallet", None, "Amber", "total_gross_weight_kg",
                f"{per:,.0f} kg on one pallet is unusually heavy (standard pallets take about 1,000 kg).",
                "Double-check the total weight and pallet count.")
        if gross == 0:
            add("S-g0", None, "Red", "total_gross_weight_kg", "Gross weight can't be 0 kg.")

    if gross is not None and items and all(it.get("unit_weight_kg") is not None and it.get("quantity") is not None for it in items):
        net = sum(it["unit_weight_kg"] * it["quantity"] for it in items)
        if gross < net:
            add("R-07", "R-07", "Amber", "total_gross_weight_kg",
                f"Gross weight {gross:,.0f} kg is less than the goods alone ({net:,.0f} kg).",
                f"Reweigh: it should be at least {net:,.0f} kg plus cartons and pallets.")

    if b.get("destination_type") == "Warehouse" and b.get("delivery_appointment_booked") is False:
        add("R-08", "R-08", "Amber", "delivery_appointment_booked",
            "Warehouse deliveries without an appointment are often turned away.",
            "Book a delivery slot with the receiving warehouse.")

    d = _date(b.get("ready_to_ship_date"))
    if d and d < today:
        add("R-10", "R-10", "Amber", "ready_to_ship_date",
            f"{d:%d %b %Y} is in the past.", "Use the date the goods will actually be ready.")
    elif d and (d - today).days > 365:
        add("S-date", None, "Amber", "ready_to_ship_date", f"{d:%d %b %Y} is more than a year away — is the year right?")

    inv = draft.get("invoice") or {}
    eori = inv.get("seller_eori")
    if eori and not (eori.upper().startswith("GB") and eori[2:].isdigit() and len(eori) in (14, 17)):
        add("S-eori", None, "Amber", "invoice.seller_eori",
            f"“{eori}” doesn't look like a UK EORI (GB followed by 12 or 15 digits).")
    return out
