"""Sheet 3 rate card.

PLACEHOLDER VALUES - the real rate card lives in
Case2_Shipment_Booking_Test_Data_Format.xlsx (Sheet 3). Replace CARRIERS with
those rows before submitting; only the first row below comes from the case brief.
"""
from pydantic import BaseModel

from .schemas import DestinationCountry


class CarrierOption(BaseModel):
    carrier: str
    service: str
    destination_country: DestinationCountry
    price_per_pallet: float
    transit_days: int
    on_time_rate: float
    max_weight_per_pallet_kg: float

    @property
    def label(self) -> str:
        return f"{self.carrier} · {self.service}"


_DE, _FR, _NL = DestinationCountry.GERMANY, DestinationCountry.FRANCE, DestinationCountry.NETHERLANDS

CARRIERS: list[CarrierOption] = [
    CarrierOption(carrier="Carrier A", service="Road economy", destination_country=_DE,
                  price_per_pallet=180, transit_days=5, on_time_rate=92, max_weight_per_pallet_kg=500),
    CarrierOption(carrier="Carrier B", service="Road express", destination_country=_DE,
                  price_per_pallet=260, transit_days=2, on_time_rate=95, max_weight_per_pallet_kg=400),
    CarrierOption(carrier="Carrier A", service="Road economy", destination_country=_FR,
                  price_per_pallet=170, transit_days=4, on_time_rate=90, max_weight_per_pallet_kg=500),
    CarrierOption(carrier="Carrier C", service="Road standard", destination_country=_FR,
                  price_per_pallet=210, transit_days=3, on_time_rate=97, max_weight_per_pallet_kg=600),
    CarrierOption(carrier="Carrier B", service="Road express", destination_country=_NL,
                  price_per_pallet=240, transit_days=2, on_time_rate=94, max_weight_per_pallet_kg=400),
    CarrierOption(carrier="Carrier C", service="Road standard", destination_country=_NL,
                  price_per_pallet=190, transit_days=3, on_time_rate=96, max_weight_per_pallet_kg=600),
]


def carriers_for(destination: DestinationCountry) -> list[CarrierOption]:
    return [c for c in CARRIERS if c.destination_country == destination]
