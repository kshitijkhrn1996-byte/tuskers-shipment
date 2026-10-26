"""Deterministic pre-flight checks R-01..R-10 (Sheet 4).

Every rule returns a RuleResult, pass or fail, so the dashboard can show a
full checklist. Failures carry the fault, severity and a plain-language fix.
"""
from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from .carriers import CarrierOption, carriers_for
from .schemas import Booking, DestinationType


class Severity(str, Enum):
    RED = "Red"
    AMBER = "Amber"


class Status(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    PENDING = "pending"  # R-05 before a carrier is chosen


class RuleResult(BaseModel):
    rule_id: str
    title: str
    severity: Severity
    status: Status
    fault: Optional[str] = None
    fix: Optional[str] = None


DANGEROUS_KEYWORDS = {
    "lithium battery": ["lithium", "li-ion", "li ion", "lipo", "li-po", "power bank", "powerbank",
                        "18650", "e-cigarette", "e-cig", "vape"],
    "aerosol": ["aerosol", "spray can", "spray paint", "deodorant spray", "spray deodorant", "body spray",
                "hairspray", "hair spray", "air freshener spray", "dry shampoo"],
    "flammable liquid": ["flammable", "petrol", "gasoline", "lighter fluid", "lamp oil", "paint thinner",
                         "white spirit", "turpentine", "acetone", "nail polish", "nail varnish",
                         "methylated spirit", "kerosene", "isopropyl", "ethanol", "hand sanitiser",
                         "hand sanitizer"],
}
# Words that often mean dangerous goods but not always: flagged as "check", never blocking.
POSSIBLE_DANGEROUS = {
    "battery": "batteries — fine if alkaline, but lithium batteries can't go on these services",
    "batteries": "batteries — fine if alkaline, but lithium batteries can't go on these services",
    "spray": "a spray — if it's an aerosol can, it can't go on these services",
    "perfume": "perfume — usually alcohol-based, which counts as a flammable liquid",
    "eau de": "fragrance — usually alcohol-based, which counts as a flammable liquid",
    "cologne": "cologne — usually alcohol-based, which counts as a flammable liquid",
    "solvent": "a solvent — many are flammable liquids",
    "varnish": "varnish — many are flammable liquids",
}


def dangerous_category(text: str) -> Optional[str]:
    text = text.lower()
    for category, words in DANGEROUS_KEYWORDS.items():
        if any(w in text for w in words):
            return category
    return None


def possible_dangerous(text: str) -> Optional[str]:
    """Only meaningful when dangerous_category() found nothing."""
    text = text.lower()
    return next((why for word, why in POSSIBLE_DANGEROUS.items() if word in text), None)

VALUE_TOLERANCE = 0.01


def _ok(rule_id, title, sev):
    return RuleResult(rule_id=rule_id, title=title, severity=sev, status=Status.PASS)


def _fail(rule_id, title, sev, fault, fix):
    return RuleResult(rule_id=rule_id, title=title, severity=sev, status=Status.FAIL,
                      fault=fault, fix=fix)


def r01_hs_code(b: Booking) -> RuleResult:
    t, s = "HS code of at least 6 digits", Severity.RED
    bad = [i for i in b.items if not (i.hs_code and i.hs_code.isdigit() and len(i.hs_code) >= 6)]
    if not bad:
        return _ok("R-01", t, s)
    detail = "; ".join(f"{i.sku}: {i.hs_code or 'blank'}" for i in bad)
    fix = ("Look up each product's code (at least 6 digits) in the UK Trade Tariff "
           "and add it, otherwise customs can hold the shipment.")
    five = [i.hs_code for i in bad if i.hs_code and i.hs_code.isdigit() and len(i.hs_code) == 5]
    if five:
        fix += (f" If {five[0]} should start with 0 (chapters 01–09), the spreadsheet dropped the leading "
                f"zero — enter it as text, e.g. 0{five[0]}.")
    return _fail("R-01", t, s, f"Missing or too-short HS code ({detail}).", fix)


def r02_declared_value(b: Booking) -> RuleResult:
    t, s = "Declared value matches items", Severity.RED
    expected = sum(i.quantity * i.unit_price for i in b.items)
    diff = abs(b.total_declared_value - expected)
    if diff <= VALUE_TOLERANCE * expected:
        return _ok("R-02", t, s)
    return _fail("R-02", t, s,
                 f"Declared £{b.total_declared_value:,.2f} but items add up to £{expected:,.2f} "
                 f"(off by £{diff:,.2f}).",
                 f"Change the total declared value to £{expected:,.2f}, or correct the item "
                 "quantities/prices so they match the invoice.")


def r03_units_per_carton(b: Booking) -> RuleResult:
    t, s = "Units per carton × cartons = quantity", Severity.RED
    bad = [i for i in b.items if i.units_per_carton * i.cartons != i.quantity]
    if not bad:
        return _ok("R-03", t, s)
    detail = "; ".join(f"{i.sku}: {i.units_per_carton}×{i.cartons}={i.units_per_carton * i.cartons}, "
                       f"stated {i.quantity}" for i in bad)
    return _fail("R-03", t, s, f"Packed units don't match quantity ({detail}).",
                 "Recount the cartons or units for these products; the receiving warehouse "
                 "will report missing units if the numbers don't agree.")


def r04_total_cartons(b: Booking) -> RuleResult:
    t, s = "Booking cartons = sum of item cartons", Severity.RED
    total = sum(i.cartons for i in b.items)
    if total == b.cartons:
        return _ok("R-04", t, s)
    return _fail("R-04", t, s, f"Booking says {b.cartons} cartons but items add up to {total}.",
                 f"Set the booking's carton count to {total}, or fix the item carton counts.")


def r05_pallet_weight(b: Booking, carrier: Optional[CarrierOption]) -> RuleResult:
    t, s = "Weight per pallet within carrier limit", Severity.RED
    per_pallet = b.total_gross_weight_kg / b.pallets
    if carrier is None:
        return RuleResult(rule_id="R-05", title=t, severity=s, status=Status.PENDING,
                          fault=f"{per_pallet:,.1f} kg per pallet; checked once a carrier is chosen.")
    limit = carrier.max_weight_per_pallet_kg
    if per_pallet <= limit:
        return _ok("R-05", t, s)
    min_pallets = -(-b.total_gross_weight_kg // limit)  # ceil
    roomier = [c for c in carriers_for(b.destination_country) if c.max_weight_per_pallet_kg >= per_pallet]
    fix = f"Spread the load over at least {int(min_pallets)} pallets"
    fix += (f", or switch to {' / '.join(c.label for c in roomier)}, which takes this weight."
            if roomier else f" — {limit:,.0f} kg is the highest pallet limit on this route.")
    return _fail("R-05", t, s,
                 f"{per_pallet:,.1f} kg per pallet exceeds {carrier.label}'s limit of {limit:,.0f} kg.", fix)


def r06_dangerous_goods(b: Booking) -> RuleResult:
    t, s = "No lithium batteries, aerosols or flammable liquids", Severity.RED
    hits = []
    for i in b.items:
        category = dangerous_category(f"{i.sku} {i.description}")
        if category:
            hits.append(f"{i.sku} ({category})")
    if not hits:
        return _ok("R-06", t, s)
    return _fail("R-06", t, s, f"Restricted goods found: {', '.join(hits)}.",
                 "Remove these items from the booking; they need a specialist "
                 "dangerous-goods service and cannot ship on these carriers.")


def r07_gross_weight(b: Booking) -> RuleResult:
    t, s = "Gross weight ≥ net weight of items", Severity.AMBER
    net = sum(i.unit_weight_kg * i.quantity for i in b.items)
    if b.total_gross_weight_kg >= net:
        return _ok("R-07", t, s)
    return _fail("R-07", t, s,
                 f"Gross weight {b.total_gross_weight_kg:,.1f} kg is less than the goods alone "
                 f"({net:,.1f} kg).",
                 f"Reweigh the shipment; gross weight must be at least {net:,.1f} kg plus "
                 "cartons and pallets.")


def r08_appointment(b: Booking) -> RuleResult:
    t, s = "Warehouse delivery has an appointment", Severity.AMBER
    if b.destination_type != DestinationType.WAREHOUSE or b.delivery_appointment_booked:
        return _ok("R-08", t, s)
    return _fail("R-08", t, s, "Delivering to a warehouse with no delivery appointment booked.",
                 "Book a delivery slot with the receiving warehouse before collection, "
                 "or the truck may be turned away.")


def r09_country_of_origin(b: Booking) -> RuleResult:
    t, s = "Every item has a country of origin", Severity.AMBER
    bad = [i.sku for i in b.items if i.country_of_origin is None]
    if not bad:
        return _ok("R-09", t, s)
    return _fail("R-09", t, s, f"No country of origin for: {', '.join(bad)}.",
                 "Add where each product was made (not where it ships from); customs uses "
                 "it to work out duty.")


def r10_ready_date(b: Booking, today: date) -> RuleResult:
    t, s = "Ready to ship date not in the past", Severity.AMBER
    if b.ready_to_ship_date >= today:
        return _ok("R-10", t, s)
    return _fail("R-10", t, s,
                 f"Ready date {b.ready_to_ship_date:%d-%m-%Y} is before today ({today:%d-%m-%Y}).",
                 "Set the date the goods will actually be packed and ready for collection.")


def run_rulebook(b: Booking, carrier: Optional[CarrierOption] = None,
                 today: Optional[date] = None) -> list[RuleResult]:
    today = today or date.today()
    return [
        r01_hs_code(b), r02_declared_value(b), r03_units_per_carton(b), r04_total_cartons(b),
        r05_pallet_weight(b, carrier), r06_dangerous_goods(b), r07_gross_weight(b),
        r08_appointment(b), r09_country_of_origin(b), r10_ready_date(b, today),
    ]


def is_blocked(results: list[RuleResult]) -> bool:
    return any(r.status == Status.FAIL and r.severity == Severity.RED for r in results)
