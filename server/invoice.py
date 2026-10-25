"""Commercial (export) invoice, following the UK government's checklist:
invoice number and date, seller and buyer, consignee, related paperwork,
unit prices, payment terms and currency, quantities, gross/net weight and
packages, HS codes with plain descriptions, Incoterms, package marks,
country of origin, transport details, total value and additional charges.

Booking data fills most of it; the invoice-only details (addresses, buyer,
Incoterms, payment terms) come from the draft's "invoice" section.
"""
from datetime import date
from typing import Optional

from .draft import INVOICE_REQUIRED, LABELS
from .evaluate import Report

# Incoterms where the seller pays main carriage, so freight goes on the invoice total.
SELLER_PAYS_FREIGHT = {"CPT", "CIP", "DAP", "DPU", "DDP", "CFR", "CIF"}


def build_invoice(report: Report, details: dict, today: date) -> dict:
    b = report.booking
    chosen = report.recommendation.chosen
    lines = [{
        "sku": it.sku, "description": it.description, "hs_code": it.hs_code or "",
        "country_of_origin": it.country_of_origin.value if it.country_of_origin else "",
        "quantity": it.quantity, "unit_price": it.unit_price,
        "line_total": round(it.quantity * it.unit_price, 2),
        "net_weight_kg": round(it.unit_weight_kg * it.quantity, 2), "cartons": it.cartons,
    } for it in b.items]
    goods_total = round(sum(line["line_total"] for line in lines), 2)
    incoterm = (details.get("incoterms") or "").upper()
    freight = chosen.total_cost if chosen else None
    freight_on_invoice = bool(freight) and incoterm in SELLER_PAYS_FREIGHT
    total = round(goods_total + (freight if freight_on_invoice else 0), 2)

    missing = [{"field": f, "label": LABELS[f], "severity": "Red"} for f in INVOICE_REQUIRED if not details.get(f)]
    if not details.get("seller_eori"):
        missing.append({"field": "seller_eori", "label": LABELS["seller_eori"], "severity": "Amber",
                        "note": "Needed for the UK export declaration."})
    problems = [f"{c.rule_id}: {c.fault}" for c in report.checks if c.status == "fail" and c.rule_id in ("R-01", "R-02", "R-09")]

    return {
        "invoice_number": f"INV-{b.booking_id}-{today:%y%m%d}",
        "invoice_date": today.strftime("%d %b %Y"),
        "currency": "GBP",
        "seller": {"name": b.seller_name, "address": details.get("seller_address", ""),
                   "contact": details.get("seller_contact", ""), "eori": details.get("seller_eori", "")},
        "buyer": {"name": details.get("buyer_name", ""), "address": details.get("buyer_address", ""),
                  "contact": details.get("buyer_contact", "")},
        "consignee": {"name": details.get("consignee_name") or details.get("buyer_name", ""),
                      "address": details.get("consignee_address") or details.get("buyer_address", ""),
                      "same_as_buyer": not details.get("consignee_name")},
        "related_docs": details.get("related_docs", ""),
        "payment_terms": details.get("payment_terms", ""),
        "incoterms": f"{incoterm} {b.destination_city}" if incoterm else "",
        "reason_for_export": details.get("reason_for_export") or "Sale",
        "lines": lines,
        "packages": f"{b.cartons} cartons on {b.pallets} pallet(s)",
        "marks": f"{b.booking_id} / Carton 1–{b.cartons} of {b.cartons}",
        "net_weight_kg": round(sum(line["net_weight_kg"] for line in lines), 2),
        "gross_weight_kg": b.total_gross_weight_kg,
        "transport": (f"Road freight, {chosen.option.label}, {b.origin_city.value} (UK) → "
                      f"{b.destination_city}, {b.destination_country.value}" if chosen else
                      f"Road freight, {b.origin_city.value} (UK) → {b.destination_city}, {b.destination_country.value}"),
        "ship_date": b.ready_to_ship_date.strftime("%d %b %Y"),
        "goods_total": goods_total,
        "freight": freight,
        "freight_on_invoice": freight_on_invoice,
        "total": total,
        "declaration": ("I declare that the information on this invoice is true and correct, and that the "
                        "goods are of the origin shown."),
        "missing": missing,
        "problems": problems,
        "is_draft": bool(missing and any(m["severity"] == "Red" for m in missing)) or report.blocked,
    }


def invoice_question(missing: list[str]) -> Optional[str]:
    if not missing:
        return None
    asks = {
        "seller_address": "your business address",
        "buyer_name": "the buyer's name",
        "buyer_address": "the buyer's address",
        "incoterms": "the Incoterms you agreed (DAP is usual for road freight to the buyer's door)",
        "payment_terms": "the payment terms (e.g. 30 days from invoice, bank transfer)",
    }
    parts = [asks[f] for f in missing if f in asks]
    joined = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    return f"For the commercial invoice I need {joined}. Your EORI number helps too, if you have one."
