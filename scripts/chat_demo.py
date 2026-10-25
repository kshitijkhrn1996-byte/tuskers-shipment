"""Drive the agent through a scripted conversation (needs GEMINI_API_KEY)."""
import sys
from datetime import date
from pathlib import Path

for line in (Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
    if "=" in line:
        import os
        k, v = line.split("=", 1)
        os.environ.setdefault(k, v)

from server.agent import empty_draft, run_turn  # noqa: E402

turns = sys.argv[1:] or [
    "Hi, I'm Northfield Goods. I need to send 1080 ceramic mugs from Manchester to a warehouse in Frankfurt.",
    "They're £5 each, 12 to a carton, half a kilo each. HS 691200, made in the UK.",
    "3 pallets, 620 kg total",
    "Ready on 5 November, appointment is booked, cheapest please",
    "Actually add a pallet",
]
draft, history = empty_draft(), []
for msg in turns:
    out = run_turn(draft, history, msg, date(2026, 10, 25))
    draft = out["draft"]
    history += [{"role": "user", "content": msg}, {"role": "assistant", "content": out["reply"]}]
    print(f"\nSELLER: {msg}\nAGENT:  {out['reply']}")
    if out.get("report"):
        r = out["report"]
        print("  -> fails:", [c["rule_id"] for c in r["checks"] if c["status"] == "fail"],
              "| carrier:", r["recommendation"]["chosen"] and r["recommendation"]["chosen"]["option"]["service"],
              "| pallets:", r["booking"]["pallets"])
