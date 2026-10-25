from datetime import date

from server.draft import apply_patch, empty_draft, missing_fields
from server.live_checks import live_issues

TODAY = date(2026, 10, 26)


def keys(draft):
    return {i.key for i in live_issues(draft, TODAY)}


def patch(**kw):
    d, errors, _ = apply_patch(empty_draft(), kw)
    return d, errors


def test_rejects_values_outside_allowed_lists():
    d, errors = patch(booking={"origin_city": "Glasgow", "destination_city": "Madrid", "seller_priority": "cheap"})
    assert {e["field"] for e in errors} == {"origin_city", "destination_city"}
    assert d["booking"]["seller_priority"] == "Cheapest"
    assert "origin_city" not in d["booking"]


def test_partial_item_flags_hs_cartons_and_dangerous_goods_immediately():
    d, _ = patch(items=[{"description": "Lithium power bank", "hs_code": "8507", "quantity": 300,
                         "units_per_carton": 10, "cartons": 25}])
    assert {"R-01:0", "R-03:0", "R-06:0"} <= keys(d)
    assert "items.0.unit_price" in missing_fields(d)


def test_pallet_too_heavy_for_every_carrier_flags_r05():
    d, _ = patch(booking={"destination_city": "Frankfurt", "pallets": 1, "total_gross_weight_kg": 900})
    assert "R-05" in keys(d)


def test_past_date_and_missing_appointment_flag_amber():
    d, _ = patch(booking={"ready_to_ship_date": "01-10-2026", "destination_type": "Warehouse",
                          "delivery_appointment_booked": False})
    assert {"R-10", "R-08"} <= keys(d)


def test_stated_declared_value_mismatch_flags_r02_but_derived_does_not():
    items = [{"description": "Mug", "quantity": 100, "unit_price": 5, "units_per_carton": 10}]
    d, _ = patch(items=items)
    assert d["booking"]["total_declared_value"] == 500 and "R-02" not in keys(d)
    d2, _, _ = apply_patch(d, {"booking": {"total_declared_value": 700}})
    assert "R-02" in keys(d2)


def test_form_echo_of_derived_total_stays_derived():
    d, _ = patch(items=[{"description": "Mug", "quantity": 100, "unit_price": 5, "units_per_carton": 10}])
    form = {"booking": dict(d["booking"]), "items": d["items"]}
    d2, _, _ = apply_patch(d, form, replace=True)
    assert "cartons" in d2["derived"]


def test_form_blank_origin_is_missing_until_marked_unknown():
    item = {"description": "Mug", "quantity": 10, "unit_price": 1, "units_per_carton": 10, "unit_weight_kg": 1,
            "hs_code": "691200"}
    d, _, _ = apply_patch(empty_draft(), {"items": [item]}, replace=True)
    assert "items.0.country_of_origin" in missing_fields(d) and "R-09:0" not in keys(d)
    d2, _, _ = apply_patch(d, {"items": [item], "unknown": ["items.0.country_of_origin"]}, replace=True)
    assert "items.0.country_of_origin" not in missing_fields(d2) and "R-09:0" in keys(d2)
