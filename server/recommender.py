"""Carrier recommendation against the Sheet 3 rate card.

1. Keep services that run the booking's route.
2. Drop services whose max weight per pallet is below the booking's
   weight per pallet (they would break R-05).
3. Rank the rest by the seller's priority. "Balanced" uses Min-Max
   normalisation of cost, transit and on-time rate, then an equal-weight sum.
"""
from typing import Optional

from pydantic import BaseModel

from .carriers import CarrierOption, carriers_for
from .schemas import Booking, Priority

BALANCED_WEIGHTS = {"cost": 1 / 3, "speed": 1 / 3, "reliability": 1 / 3}


class ScoredOption(BaseModel):
    option: CarrierOption
    total_cost: float
    score: Optional[float] = None  # Balanced only, 0..1, higher is better
    excluded_reason: Optional[str] = None


class Recommendation(BaseModel):
    chosen: Optional[ScoredOption]
    ranked: list[ScoredOption]
    excluded: list[ScoredOption]
    reason: str


def _minmax(value: float, lo: float, hi: float, higher_is_better: bool) -> float:
    if hi == lo:
        return 1.0
    x = (value - lo) / (hi - lo)
    return x if higher_is_better else 1 - x


def recommend(b: Booking) -> Recommendation:
    per_pallet = b.total_gross_weight_kg / b.pallets
    on_route = carriers_for(b.destination_country)
    fits, excluded = [], []
    for c in on_route:
        s = ScoredOption(option=c, total_cost=c.price_per_pallet * b.pallets)
        if c.max_weight_per_pallet_kg < per_pallet:
            s.excluded_reason = (f"max {c.max_weight_per_pallet_kg:,.0f} kg per pallet, "
                                 f"shipment needs {per_pallet:,.1f} kg")
            excluded.append(s)
        else:
            fits.append(s)

    if not fits:
        return Recommendation(
            chosen=None, ranked=[], excluded=excluded,
            reason=(f"No carrier on UK → {b.destination_country.value} accepts "
                    f"{per_pallet:,.1f} kg per pallet. Add pallets to lower the weight per pallet."))

    p = b.seller_priority
    if p == Priority.CHEAPEST:
        fits.sort(key=lambda s: (s.total_cost, s.option.transit_days))
        top = fits[0]
        reason = (f"Cheapest option that fits: £{top.total_cost:,.0f} for {b.pallets} pallet(s) "
                  f"(£{top.option.price_per_pallet:,.0f} each)")
    elif p == Priority.FASTEST:
        fits.sort(key=lambda s: (s.option.transit_days, s.total_cost))
        top = fits[0]
        reason = f"Fastest option that fits: {top.option.transit_days} day(s) in transit"
    elif p == Priority.MOST_RELIABLE:
        fits.sort(key=lambda s: (-s.option.on_time_rate, s.total_cost))
        top = fits[0]
        reason = f"Most reliable option that fits: {top.option.on_time_rate:g}% on time"
    else:
        costs = [s.total_cost for s in fits]
        days = [s.option.transit_days for s in fits]
        rates = [s.option.on_time_rate for s in fits]
        for s in fits:
            s.score = round(
                BALANCED_WEIGHTS["cost"] * _minmax(s.total_cost, min(costs), max(costs), False)
                + BALANCED_WEIGHTS["speed"] * _minmax(s.option.transit_days, min(days), max(days), False)
                + BALANCED_WEIGHTS["reliability"] * _minmax(s.option.on_time_rate, min(rates), max(rates), True),
                3)
        fits.sort(key=lambda s: (-s.score, s.total_cost))
        top = fits[0]
        reason = (f"Best balance of cost, speed and reliability (score {top.score:.2f} of 1.00; "
                  f"each scaled 0–1 across the options and weighted equally)")

    reason += (f": {top.option.label}, £{top.total_cost:,.0f}, {top.option.transit_days} days, "
               f"{top.option.on_time_rate:g}% on time.")
    if len(fits) > 1:
        runner = fits[1]
        reason += (f" Runner-up {runner.option.label}: £{runner.total_cost:,.0f}, "
                   f"{runner.option.transit_days} days, {runner.option.on_time_rate:g}% on time.")
    if excluded:
        reason += " Excluded: " + "; ".join(f"{s.option.label} ({s.excluded_reason})" for s in excluded) + "."
    return Recommendation(chosen=top, ranked=fits, excluded=excluded, reason=reason)


def r05_carrier(b: Booking, rec: Recommendation) -> CarrierOption:
    """Carrier R-05 is checked against: the pick, or the roomiest on the route if none fits."""
    if rec.chosen:
        return rec.chosen.option
    return max(carriers_for(b.destination_country), key=lambda c: c.max_weight_per_pallet_kg)
