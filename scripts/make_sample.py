"""Build public/sample-shipments.xlsx in the judges' Sheet 1 + Sheet 2 format,
with planted mistakes, for testing uploads."""
from pathlib import Path

from openpyxl import Workbook

BOOKING_HEADERS = ["Booking ID", "Seller name", "Origin city", "Origin country", "Destination city",
                   "Destination country", "Destination type", "Ready to ship date", "Seller priority",
                   "Pallets", "Cartons", "Total declared value", "Currency", "Total gross weight (kg)",
                   "Delivery appointment booked"]
ITEM_HEADERS = ["Booking ID", "SKU", "Description", "HS code", "Quantity (units)", "Unit price",
                "Units per carton", "Cartons", "Unit weight (kg)", "Country of origin"]

BOOKINGS = [
    # clean
    ["BK-006", "Northfield Goods", "Manchester", "United Kingdom", "Frankfurt", "Germany", "Warehouse",
     "05-11-2026", "Cheapest", 3, 90, 5400, "GBP", 620, "Yes"],
    # R-02 value off, R-08 no appointment
    ["BK-002", "Thames Textiles", "London", "United Kingdom", "Paris", "France", "Warehouse",
     "10-11-2026", "Fastest", 2, 60, 4000, "GBP", 380, "No"],
    # R-01 short HS, R-03 carton maths, R-09 missing origin, R-07 gross < net
    ["BK-003", "Pennine Home", "Leeds", "United Kingdom", "Amsterdam", "Netherlands", "Business address",
     "12-11-2026", "Balanced", 2, 50, 3000, "GBP", 300, "No"],
    # R-05 too heavy for every carrier (800 kg on one pallet, max 750)
    ["BK-004", "Brum Hardware", "Birmingham", "United Kingdom", "Hamburg", "Germany", "Business address",
     "15-11-2026", "Most reliable", 1, 40, 2400, "GBP", 800, "No"],
    # R-06 lithium, R-04 carton total, R-10 date in the past
    ["BK-005", "Gadget Lane", "London", "United Kingdom", "Lyon", "France", "Warehouse",
     "01-10-2026", "Balanced", 2, 50, 6000, "GBP", 300, "Yes"],
]
ITEMS = [
    ["BK-006", "MUG-01", "Ceramic coffee mug, 350 ml", 691200, 1080, 5.00, 12, 90, 0.5, "United Kingdom"],
    ["BK-002", "TSH-01", "Cotton t-shirt", 610910, 600, 6.00, 20, 30, 0.2, "India"],
    ["BK-002", "SCF-02", "Wool scarf", 611710, 300, 4.00, 10, 30, 0.15, "Turkey"],
    ["BK-003", "LMP-01", "Table lamp", 9405, 200, 10.00, 4, 50, 1.5, "China"],
    ["BK-003", "CUS-02", "Cushion cover", 630492, 100, 10.00, 10, 0, 0.2, None],
    ["BK-004", "HAM-01", "Steel claw hammer", 820520, 400, 6.00, 10, 40, 1.8, "Germany"],
    ["BK-005", "PWB-01", "Lithium battery power bank 10000mAh", 850760, 300, 15.00, 10, 30, 0.3, "China"],
    ["BK-005", "CBL-02", "USB-C charging cable", 854442, 300, 5.00, 20, 15, 0.05, "Vietnam"],
]


def build(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Bookings"
    ws.append(BOOKING_HEADERS)
    for r in BOOKINGS:
        ws.append(r)
    ws2 = wb.create_sheet("Items")
    ws2.append(ITEM_HEADERS)
    for r in ITEMS:
        ws2.append(r)
    wb.save(path)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "public" / "sample-shipments.xlsx"
    build(out)
    print(out)
