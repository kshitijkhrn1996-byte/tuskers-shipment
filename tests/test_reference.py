"""HS / SKU reference checks, with the database and model stubbed out."""
from server import hs


def setup_module():
    hs.index.cache_clear()
    hs.db.select = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline"))  # force the bundled CSV
    hs.db.get_one = lambda *a, **k: None
    hs.db.insert = lambda *a, **k: None


def test_lookup_uses_real_nomenclature_and_rejects_reserved_chapters():
    assert hs.lookup("691200")["subheading"].startswith("Ceramic tableware")
    assert hs.lookup("6912002310")["code"] == "69120023"   # 10-digit codes checked on their 8-digit line
    assert hs.lookup("69120010") is None                     # 8-digit line that doesn't exist
    assert hs.lookup("999999") is None and hs.lookup("123456") is None and hs.lookup("6912") is None


def test_unknown_code_is_flagged_red_and_mismatch_amber(monkeypatch):
    monkeypatch.setattr(hs, "judge_match", lambda d, c, suggest=False: {"fits": "no", "reason": "Not apparel.", "suggestions": []})
    monkeypatch.setattr(hs, "catalogue", lambda skus: {})
    issues = hs.item_issues([{"sku": "A", "description": "Wool scarf", "hs_code": "123456"},
                             {"sku": "B", "description": "Ceramic mug", "hs_code": "610910"}])
    by_key = {i["key"]: i for i in issues}
    assert by_key["HS-unknown:0"]["severity"] == "Red"
    assert by_key["HS-mismatch:1"]["severity"] == "Amber" and "T-shirts" in by_key["HS-mismatch:1"]["message"]


def test_known_sku_with_different_details_is_flagged(monkeypatch):
    monkeypatch.setattr(hs, "judge_match", lambda *a, **k: {"fits": "yes", "reason": "", "suggestions": []})
    monkeypatch.setattr(hs, "catalogue", lambda skus: {"MUG-01": {"sku": "MUG-01", "description": "Ceramic coffee mug",
                                                                  "hs_code": "691200", "unit_weight_kg": 0.5}})
    issues = hs.item_issues([{"sku": "MUG-01", "description": "Ceramic coffee mug", "hs_code": "691200", "unit_weight_kg": 0.5}])
    assert issues == []
    issues = hs.item_issues([{"sku": "MUG-01", "description": "Steel hammer", "hs_code": "820520", "unit_weight_kg": 1.8}])
    assert issues[0]["key"] == "SKU-diff:0" and "HS 691200" in issues[0]["message"] and "0.5 kg" in issues[0]["message"]


def test_finder_matcher_codes_and_notices(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert [r["code"] for r in hs.find("6109.10.00")] == ["61091000"]
    assert hs.find("power bank")[0]["code"] == "85076000"
    assert [n["kind"] for n in hs.find_full("gifts")["notices"]] == ["vague"] and hs.find("gifts") == []
    assert [n["kind"] for n in hs.find_full("pepper spray")["notices"]] == ["restricted"]


def test_vague_and_restricted_descriptions_are_flagged(monkeypatch):
    monkeypatch.setattr(hs, "catalogue", lambda skus: {})
    issues = hs.item_issues([{"description": "samples"}, {"description": "Pepper spray 50ml"}], judge=False)
    assert {i["key"]: i["severity"] for i in issues} == {"DESC-vague:0": "Amber", "DESC-restricted:1": "Red"}
