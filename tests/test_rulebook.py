from datetime import date

import pytest
from pydantic import ValidationError

from server.carriers import carriers_for
from server.schemas import Booking, DestinationCountry
from server.rulebook import Status, is_blocked, run_rulebook

TODAY = date(2026, 10, 25)
CARRIER = carriers_for(DestinationCountry.GERMANY)[0]  # 500 kg max


def booking(**over):
    item = dict(booking_id="BK-001", sku="MUG-01", description="Ceramic coffee mug, 350 ml",
                hs_code=691200, quantity=1080, unit_price=5.00, units_per_carton=12,
                cartons=90, unit_weight_kg=0.5, country_of_origin="United Kingdom")
    item.update(over.pop("item", {}))
    data = dict(booking_id="BK-001", seller_name="Northfield Goods", origin_city="Manchester",
                origin_country="United Kingdom", destination_city="Frankfurt",
                destination_country="Germany", destination_type="Warehouse",
                ready_to_ship_date="05-11-2026", seller_priority="Cheapest", pallets=3,
                cartons=90, total_declared_value=5400, currency="GBP",
                total_gross_weight_kg=620, delivery_appointment_booked="Yes", items=[item])
    data.update(over)
    return Booking.model_validate(data)


def failed(b, carrier=CARRIER):
    return {r.rule_id for r in run_rulebook(b, carrier, TODAY) if r.status == Status.FAIL}


def test_brief_example_is_clean():
    assert failed(booking()) == set()


@pytest.mark.parametrize("over,rule", [
    ({"item": {"hs_code": "6912"}}, "R-01"),
    ({"item": {"hs_code": None}}, "R-01"),
    ({"total_declared_value": 5500}, "R-02"),
    ({"item": {"cartons": 89}, "cartons": 89}, "R-03"),
    ({"cartons": 91}, "R-04"),
    ({"pallets": 1}, "R-05"),
    ({"item": {"description": "Lithium battery pack"}}, "R-06"),
    ({"total_gross_weight_kg": 500}, "R-07"),
    ({"delivery_appointment_booked": "No"}, "R-08"),
    ({"item": {"country_of_origin": ""}}, "R-09"),
    ({"ready_to_ship_date": "01-10-2026"}, "R-10"),
])
def test_planted_errors(over, rule):
    assert rule in failed(booking(**over))


def test_declared_value_within_one_percent_passes():
    assert "R-02" not in failed(booking(total_declared_value=5450))


def test_business_address_needs_no_appointment():
    b = booking(destination_type="Business address", delivery_appointment_booked="No")
    assert "R-08" not in failed(b)


def test_r05_pending_without_carrier():
    r05 = next(r for r in run_rulebook(booking(), None, TODAY) if r.rule_id == "R-05")
    assert r05.status == Status.PENDING


def test_amber_does_not_block_red_does():
    amber = run_rulebook(booking(delivery_appointment_booked="No"), CARRIER, TODAY)
    red = run_rulebook(booking(cartons=91), CARRIER, TODAY)
    assert not is_blocked(amber) and is_blocked(red)


@pytest.mark.parametrize("over", [
    {"destination_city": "Paris"},          # wrong country for city
    {"origin_city": "Glasgow"},
    {"currency": "EUR"},
    {"seller_priority": "Cheap"},
])
def test_schema_rejects_values_outside_allowed_list(over):
    with pytest.raises(ValidationError):
        booking(**over)
