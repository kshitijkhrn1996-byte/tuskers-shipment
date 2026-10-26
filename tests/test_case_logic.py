"""Case-driven checks: priorities on the real rate card, dangerous goods, uploads."""
from datetime import date

import pytest

from server.evaluate import evaluate
from server.excel import parse_files
from server.recommender import recommend
from server.schemas import Booking

TODAY = date(2026, 10, 26)


def bk(**o):
    item = dict(booking_id="X", sku="S1", description="Ceramic mug", hs_code="691200", quantity=1080,
                unit_price=5, units_per_carton=12, cartons=90, unit_weight_kg=0.5, country_of_origin="United Kingdom")
    item.update(o.pop("item", {}))
    d = dict(booking_id="X", seller_name="S", origin_city="Leeds", destination_city="Frankfurt",
             destination_country="Germany", destination_type="Warehouse", ready_to_ship_date="05-11-2026",
             seller_priority="Cheapest", pallets=3, cartons=90, total_declared_value=5400,
             total_gross_weight_kg=620, delivery_appointment_booked="Yes", items=[item])
    d.update(o)
    return Booking.model_validate(d)


@pytest.mark.parametrize("priority,carrier", [
    ("Cheapest", "Carrier A"), ("Fastest", "Carrier C"), ("Most reliable", "Carrier C"), ("Balanced", "Carrier B"),
])
def test_priority_picks_on_real_rate_card(priority, carrier):
    assert recommend(bk(seller_priority=priority)).chosen.option.carrier == carrier


@pytest.mark.parametrize("city,country", [("Paris", "France"), ("Rotterdam", "Netherlands")])
def test_balanced_is_middle_option_on_every_route(city, country):
    assert recommend(bk(seller_priority="Balanced", destination_city=city,
                        destination_country=country)).chosen.option.carrier == "Carrier B"


def test_heavy_pallet_explains_why_fastest_was_skipped():
    rec = recommend(bk(seller_priority="Fastest", pallets=1, total_gross_weight_kg=600))
    assert rec.chosen.option.carrier == "Carrier B"
    assert "Carrier C" in rec.note and "at least 2 pallets" in rec.note


def test_r05_fails_only_when_no_carrier_fits():
    ok = evaluate(bk(pallets=1, total_gross_weight_kg=750, item={"unit_weight_kg": 0.5}), TODAY)
    bad = evaluate(bk(pallets=1, total_gross_weight_kg=751), TODAY)
    assert not any(c.rule_id == "R-05" and c.status == "fail" for c in ok.checks)
    assert any(c.rule_id == "R-05" and c.status == "fail" for c in bad.checks)


@pytest.mark.parametrize("desc", ["Power bank 10000mAh", "Hairspray 250ml", "Nail polish remover",
                                  "Deodorant body spray", "Lighter fluid refill", "Li-ion battery pack"])
def test_r06_catches_common_dangerous_goods(desc):
    rep = evaluate(bk(item={"description": desc}), TODAY)
    assert any(c.rule_id == "R-06" and c.status == "fail" for c in rep.checks)


@pytest.mark.parametrize("desc", ["AA alkaline batteries", "Perfume 50ml eau de parfum"])
def test_possible_dangerous_goods_are_advisory_not_blocking(desc):
    rep = evaluate(bk(item={"description": desc}), TODAY)
    assert not rep.blocked and rep.advisories


def test_r01_hints_at_dropped_leading_zero():
    rep = evaluate(bk(item={"hs_code": 90111.0}), TODAY)
    r01 = next(c for c in rep.checks if c.rule_id == "R-01")
    assert r01.status == "fail" and "090111" in r01.fix


BOOKINGS_CSV = (
    "Booking ID,Seller name,Origin city,Origin country,Destination city,Destination country,Destination type,"
    "Ready to ship date,Seller priority,Pallets,Cartons,Total declared value,Currency,Total gross weight (kg),"
    "Delivery appointment booked\n"
    "BK-001,Northfield Goods,Manchester,United Kingdom,Frankfurt,Germany,Warehouse,05-11-2026,Cheapest,3,90,5400,GBP,620,Yes\n"
    "BK-010,Acme,London,United Kingdom,Paris,France,Business address,05-11-2026,Fastest,1,10,100,GBP,50,No\n"
    "BK-010,Acme dup,London,United Kingdom,Paris,France,Business address,05-11-2026,Fastest,1,10,100,GBP,50,No\n"
)
ITEMS_CSV = (
    "Booking ID,SKU,Description,HS code,Quantity (units),Unit price,Units per carton,Cartons,Unit weight (kg),Country of origin\n"
    "BK-001,MUG-01,\"Ceramic coffee mug, 350 ml\",691200,1080,5.00,12,90,0.5,United Kingdom\n"
    "BK-010,TEE,T-shirt,,100,1,10,10,0.2,\n"
    "BK-099,ORPHAN,Lost item,123456,1,1,1,1,1,China\n"
)


def test_separate_csv_files_with_example_row_duplicates_and_orphans():
    bookings, errors = parse_files([("bookings.csv", BOOKINGS_CSV.encode()), ("items.csv", ITEMS_CSV.encode())])
    assert [b.booking_id for b in bookings] == ["BK-010"]  # BK-001 is the template's example row
    assert bookings[0].items[0].hs_code is None and bookings[0].items[0].country_of_origin is None
    assert {e.booking_id for e in errors} == {"BK-010", "BK-099"}


def test_r05_fix_only_suggests_carriers_that_actually_fit():
    rep = evaluate(bk(pallets=1, total_gross_weight_kg=800), TODAY)
    r05 = next(c for c in rep.checks if c.rule_id == "R-05")
    assert r05.status == "fail" and "at least 2 pallets" in r05.fix and "highest pallet limit" in r05.fix
    assert "switch to" not in r05.fix


def test_compare_endpoint_matches_booking_logic_and_accepts_custom_weights():
    from fastapi.testclient import TestClient
    from server.main import app
    c = TestClient(app)
    r = c.post("/api/carriers/compare", json={"destination_country": "Germany", "pallets": 3,
                                              "total_gross_weight_kg": 620, "seller_priority": "Balanced"}).json()
    assert r["recommendation"]["chosen"]["option"]["carrier"] == "Carrier B"
    # all weight on speed -> express wins; weights are normalised
    r = c.post("/api/carriers/compare", json={"destination_country": "Germany", "pallets": 3, "total_gross_weight_kg": 620,
                                              "seller_priority": "Balanced", "weights": {"cost": 0, "speed": 5, "reliability": 0}}).json()
    assert r["recommendation"]["chosen"]["option"]["carrier"] == "Carrier C" and r["weights"]["speed"] == 1
