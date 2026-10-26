"""One booking in, full pre-flight report out: checks, carrier, confirmation."""
from datetime import date
from typing import Optional

from pydantic import BaseModel

from .recommender import Recommendation, r05_carrier, recommend
from .rulebook import RuleResult, Severity, Status, is_blocked, possible_dangerous, run_rulebook
from .schemas import Booking


class Report(BaseModel):
    booking: Booking
    checks: list[RuleResult]
    blocked: bool
    red_count: int
    amber_count: int
    recommendation: Recommendation
    confirmation: str
    next_steps: list[str]
    advisories: list[dict] = []  # "check this" notes outside the rulebook (never blocking)


def evaluate(b: Booking, today: Optional[date] = None) -> Report:
    rec = recommend(b)
    checks = run_rulebook(b, r05_carrier(b, rec), today)
    fails = [c for c in checks if c.status == Status.FAIL]
    reds = [c for c in fails if c.severity == Severity.RED]
    ambers = [c for c in fails if c.severity == Severity.AMBER]
    blocked = is_blocked(checks)

    route = (f"{b.origin_city.value} → {b.destination_city}, {b.destination_country.value} "
             f"({b.destination_type.value.lower()})")
    load = f"{b.pallets} pallet(s), {b.cartons} carton(s), {b.total_gross_weight_kg:,.0f} kg"
    if blocked:
        confirmation = (f"Booking {b.booking_id} for {b.seller_name} is ON HOLD: {len(reds)} problem(s) "
                        f"would stop this shipment at customs or the warehouse. Fix the red items "
                        f"below and re-check. Route: {route}; {load}.")
        next_steps = [f"Fix {c.rule_id}: {c.fix}" for c in reds]
        if ambers:
            next_steps.append(f"Also review {len(ambers)} warning(s) marked amber.")
        next_steps.append("Once red issues are fixed, the booking can be confirmed.")
    else:
        carrier = rec.chosen.option
        confirmation = (f"Booking {b.booking_id} for {b.seller_name} is ready. {load} from {route} "
                        f"with {carrier.label}, collected from {b.ready_to_ship_date:%d %b %Y}, "
                        f"arriving in about {carrier.transit_days} day(s). "
                        f"Price £{rec.chosen.total_cost:,.0f} (GBP).")
        if ambers:
            confirmation += f" {len(ambers)} warning(s) to review before collection."
        next_steps = [
            f"{carrier.carrier} collects from {b.origin_city.value} on {b.ready_to_ship_date:%d %b %Y}.",
            "Print the commercial invoice and attach carton labels matching the declared counts.",
            f"Goods clear UK export and {b.destination_country.value} import customs using these HS codes and values.",
            (f"Delivery to the {b.destination_city} warehouse at your booked appointment."
             if b.destination_type.value == "Warehouse" and b.delivery_appointment_booked
             else f"Delivery to {b.destination_city} in about {carrier.transit_days} day(s)."),
        ]
        next_steps[1:1] = [f"Before collection: {c.fix}" for c in ambers]
    advisories = []
    r06_failed = any(c.rule_id == "R-06" and c.status == Status.FAIL for c in checks)
    for it in b.items:
        why = None if r06_failed else possible_dangerous(f"{it.sku} {it.description}")
        if why:
            advisories.append({"message": f"{it.sku} ({it.description}) may be dangerous goods: {why}.",
                               "fix": "Check the product's safety data sheet before booking."})
    if rec.note:
        advisories.append({"message": rec.note, "fix": None})
    return Report(booking=b, checks=checks, blocked=blocked, red_count=len(reds),
                  amber_count=len(ambers), recommendation=rec, confirmation=confirmation,
                  next_steps=next_steps, advisories=advisories)
