"""Run the supplied HS search test cases through the deterministic matcher."""
import json
from pathlib import Path

from server.hs_match import suggest

CASES = json.loads((Path(__file__).parent / "hs_search_test_cases.json").read_text(encoding="utf-8"))
ANSWER = {"LIST", "LIST_LOW", "CN8", "CODE", "HS6"}


def score():
    ok, bad = 0, []
    for c in CASES:
        res = suggest(c["query"])
        codes = [r[1] for r in res if r[0] in ANSWER][:3]
        if c["acceptable_prefixes"]:
            hit = any(code.startswith(p) for code in codes for p in c["acceptable_prefixes"])
        else:  # should not give a confident answer
            hit = not [r for r in res if r[0] in {"LIST", "CODE"}]
        ok += hit
        if not hit:
            bad.append((c["query"], codes, [r[0] for r in res]))
    return ok, bad


def test_matcher_passes_supplied_cases():
    ok, bad = score()
    assert ok / len(CASES) >= 0.9, bad


if __name__ == "__main__":
    ok, bad = score()
    print(f"{ok}/{len(CASES)}")
    for b in bad:
        print(" ", b)
