"""Carrier recommendation against the Sheet 3 rate card.

1. Keep services that run the booking's route.
2. Drop services whose max weight per pallet is below the booking's
   weight per pallet (they would break R-05).
3. Rank the rest by the seller's priority. "Balanced" uses Min-Max
   normalisation of cost, transit and on-time rate, then a weighted sum
   (cost 40%, speed 30%, reliability 30%).
4. If the seller's ideal service was dropped for weight, say so and how
   many pallets would make it fit.
"""
import math
from typing import Optional

from pydantic import BaseModel

from .carriers import CarrierOption, carriers_for
from .schemas import Booking, DestinationCountry, Priority

# Equal weights made the express service win every route by a hair
# (0.667 vs 0.639) despite costing ~55% more; a slight cost tilt makes
# "balanced" pick the genuine middle option.
BALANCED_WEIGHTS = {"cost": 0.4, "speed": 0.3, "reliability": 0.3}

PRIORITY_WORD = {Priority.CHEAPEST: "cheapest", Priority.FASTEST: "fastest",
                 Priority.MOST_RELIABLE: "most reliable", Priority.BALANCED: "best-balanced"}


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
    note: Optional[str] = None  # the seller's ideal service didn't fit, and how to make it fit


def _minmax(value: float, lo: float, hi: float, higher_is_better: bool) -> float:
    if hi == lo:
        return 1.0
    x = (value - lo) / (hi - lo)
    return x if higher_is_better else 1 - x


def _rank(options: list[ScoredOption], p: Priority, weights: Optional[dict] = None) -> list[ScoredOption]:
    if p == Priority.CHEAPEST:
        return sorted(options, key=lambda s: (s.total_cost, s.option.transit_days))
    if p == Priority.FASTEST:
        return sorted(options, key=lambda s: (s.option.transit_days, s.total_cost))
    if p == Priority.MOST_RELIABLE:
        return sorted(options, key=lambda s: (-s.option.on_time_rate, s.total_cost))
    costs = [s.total_cost for s in options]
    days = [s.option.transit_days for s in options]
    rates = [s.option.on_time_rate for s in options]
    w = weights or BALANCED_WEIGHTS
    for s in options:
        s.score = round(
            w["cost"] * _minmax(s.total_cost, min(costs), max(costs), False)
            + w["speed"] * _minmax(s.option.transit_days, min(days), max(days), False)
            + w["reliability"] * _minmax(s.option.on_time_rate, min(rates), max(rates), True),
            3)
    return sorted(options, key=lambda s: (-s.score, s.total_cost))


def normalise_weights(weights: Optional[dict]) -> Optional[dict]:
    if not weights:
        return None
    w = {k: max(0.0, float(weights.get(k, 0))) for k in BALANCED_WEIGHTS}
    total = sum(w.values())
    return {k: v / total for k, v in w.items()} if total > 0 else None


def recommend(b: Booking) -> Recommendation:
    return rank_route(b.destination_country, b.pallets, b.total_gross_weight_kg, b.seller_priority)


def rank_route(destination: DestinationCountry, pallets: int, gross_kg: float, p: Priority,
               weights: Optional[dict] = None) -> Recommendation:
    """Rank the route's services for a load. Used by bookings and the carrier decision page."""
    weights = normalise_weights(weights)
    per_pallet = gross_kg / pallets
    on_route = [ScoredOption(option=c, total_cost=c.price_per_pallet * pallets)
                for c in carriers_for(destination)]
    fits, excluded = [], []
    for s in on_route:
        if s.option.max_weight_per_pallet_kg < per_pallet:
            s.excluded_reason = (f"max {s.option.max_weight_per_pallet_kg:,.0f} kg per pallet, "
                                 f"shipment needs {per_pallet:,.1f} kg")
            excluded.append(s)
        else:
            fits.append(s)

    if not fits:
        return Recommendation(
            chosen=None, ranked=[], excluded=excluded,
            reason=(f"No carrier on UK → {destination.value} accepts "
                    f"{per_pallet:,.1f} kg per pallet. Add pallets to lower the weight per pallet."))

    ranked = _rank(fits, p, weights)
    top = ranked[0]
    if p == Priority.CHEAPEST:
        reason = (f"Cheapest option that fits: £{top.total_cost:,.0f} for {pallets} pallet(s) "
                  f"(£{top.option.price_per_pallet:,.0f} each)")
    elif p == Priority.FASTEST:
        reason = f"Fastest option that fits: {top.option.transit_days} day(s) in transit"
    elif p == Priority.MOST_RELIABLE:
        reason = f"Most reliable option that fits: {top.option.on_time_rate:g}% on time"
    else:
        w = weights or BALANCED_WEIGHTS
        reason = (f"Best balance of cost, speed and reliability (score {top.score:.2f} of 1.00; each scaled 0–1 "
                  f"across the options, weighted cost {w['cost']:.0%}, speed {w['speed']:.0%}, "
                  f"reliability {w['reliability']:.0%})")

    reason += (f": {top.option.label}, £{top.total_cost:,.0f}, {top.option.transit_days} days, "
               f"{top.option.on_time_rate:g}% on time.")
    if len(ranked) > 1:
        runner = ranked[1]
        reason += (f" Runner-up {runner.option.label}: £{runner.total_cost:,.0f}, "
                   f"{runner.option.transit_days} days, {runner.option.on_time_rate:g}% on time.")

    note = None
    ideal = _rank([s.model_copy() for s in on_route], p, weights)[0]
    if ideal.option != top.option:
        need = math.ceil(gross_kg / ideal.option.max_weight_per_pallet_kg)
        note = (f"{ideal.option.label} would be the {PRIORITY_WORD[p]} option, but it only takes "
                f"{ideal.option.max_weight_per_pallet_kg:,.0f} kg per pallet and this load is {per_pallet:,.0f} kg "
                f"per pallet. To use it, spread the load over at least {need} pallets.")
        reason += " " + note
    elif excluded:
        reason += " Excluded: " + "; ".join(f"{s.option.label} ({s.excluded_reason})" for s in excluded) + "."
    return Recommendation(chosen=top, ranked=ranked, excluded=excluded, reason=reason, note=note)


def r05_carrier(b: Booking, rec: Recommendation) -> CarrierOption:
    """Carrier R-05 is checked against: the pick, or the roomiest on the route if none fits."""
    if rec.chosen:
        return rec.chosen.option
    return max(carriers_for(b.destination_country), key=lambda c: c.max_weight_per_pallet_kg)
