"""Sheet 3 rate card, copied exactly from Case2_Shipment_Booking_Test_Data_Format.xlsx
("FIXED - judges will use exactly this rate card")."""
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
    CarrierOption(carrier="Carrier B", service="Road standard", destination_country=_DE,
                  price_per_pallet=220, transit_days=3, on_time_rate=95, max_weight_per_pallet_kg=750),
    CarrierOption(carrier="Carrier C", service="Road express", destination_country=_DE,
                  price_per_pallet=340, transit_days=2, on_time_rate=98, max_weight_per_pallet_kg=400),
    CarrierOption(carrier="Carrier A", service="Road economy", destination_country=_FR,
                  price_per_pallet=170, transit_days=5, on_time_rate=92, max_weight_per_pallet_kg=500),
    CarrierOption(carrier="Carrier B", service="Road standard", destination_country=_FR,
                  price_per_pallet=210, transit_days=3, on_time_rate=95, max_weight_per_pallet_kg=750),
    CarrierOption(carrier="Carrier C", service="Road express", destination_country=_FR,
                  price_per_pallet=330, transit_days=2, on_time_rate=98, max_weight_per_pallet_kg=400),
    CarrierOption(carrier="Carrier A", service="Road economy", destination_country=_NL,
                  price_per_pallet=160, transit_days=5, on_time_rate=92, max_weight_per_pallet_kg=500),
    CarrierOption(carrier="Carrier B", service="Road standard", destination_country=_NL,
                  price_per_pallet=200, transit_days=3, on_time_rate=95, max_weight_per_pallet_kg=750),
    CarrierOption(carrier="Carrier C", service="Road express", destination_country=_NL,
                  price_per_pallet=320, transit_days=2, on_time_rate=98, max_weight_per_pallet_kg=400),
]


def carriers_for(destination: DestinationCountry) -> list[CarrierOption]:
    return [c for c in CARRIERS if c.destination_country == destination]
