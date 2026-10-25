"""Pydantic v2 models for Sheet 1 (Bookings) and Sheet 2 (Items).

Fixed-list fields are strict: anything outside the case's allowed values is
rejected at the schema layer. Numeric fields the seller "states" are only
type-checked here; whether they add up is the rulebook's job.
"""
from datetime import date, datetime
from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class OriginCountry(str, Enum):
    UK = "United Kingdom"


class OriginCity(str, Enum):
    LONDON = "London"
    MANCHESTER = "Manchester"
    BIRMINGHAM = "Birmingham"
    LEEDS = "Leeds"


class DestinationCountry(str, Enum):
    GERMANY = "Germany"
    FRANCE = "France"
    NETHERLANDS = "Netherlands"


DESTINATION_CITIES: dict[DestinationCountry, set[str]] = {
    DestinationCountry.GERMANY: {"Berlin", "Frankfurt", "Hamburg"},
    DestinationCountry.FRANCE: {"Paris", "Lyon"},
    DestinationCountry.NETHERLANDS: {"Amsterdam", "Rotterdam"},
}


class DestinationType(str, Enum):
    WAREHOUSE = "Warehouse"
    BUSINESS = "Business address"


class Priority(str, Enum):
    CHEAPEST = "Cheapest"
    FASTEST = "Fastest"
    MOST_RELIABLE = "Most reliable"
    BALANCED = "Balanced"


class Currency(str, Enum):
    GBP = "GBP"


class ItemOrigin(str, Enum):
    UK = "United Kingdom"
    CHINA = "China"
    INDIA = "India"
    VIETNAM = "Vietnam"
    TURKEY = "Turkey"
    GERMANY = "Germany"


NonNegInt = Annotated[int, Field(ge=0)]
NonNegFloat = Annotated[float, Field(ge=0)]


def _blank_to_none(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    return v


class Item(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=False)

    booking_id: str
    sku: str
    description: str
    # Kept as text so leading zeros survive; R-01 checks digits/length.
    hs_code: Optional[str] = None
    quantity: NonNegInt
    unit_price: NonNegFloat
    units_per_carton: NonNegInt
    cartons: NonNegInt
    unit_weight_kg: NonNegFloat
    country_of_origin: Optional[ItemOrigin] = None

    @field_validator("hs_code", mode="before")
    @classmethod
    def _hs_to_str(cls, v):
        v = _blank_to_none(v)
        if v is None:
            return None
        if isinstance(v, float) and v.is_integer():  # Excel numeric cells
            v = int(v)
        return str(v).strip()

    @field_validator("country_of_origin", mode="before")
    @classmethod
    def _blank_origin(cls, v):
        return _blank_to_none(v)


class Booking(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    booking_id: str
    seller_name: str
    origin_city: OriginCity
    origin_country: OriginCountry = OriginCountry.UK
    destination_city: str
    destination_country: DestinationCountry
    destination_type: DestinationType
    ready_to_ship_date: date
    seller_priority: Priority
    pallets: Annotated[int, Field(gt=0)]
    cartons: NonNegInt
    total_declared_value: NonNegFloat
    currency: Currency = Currency.GBP
    total_gross_weight_kg: NonNegFloat
    delivery_appointment_booked: bool
    items: list[Item] = Field(default_factory=list)

    @field_validator("ready_to_ship_date", mode="before")
    @classmethod
    def _parse_ddmmyyyy(cls, v):
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            return datetime.strptime(v.strip(), "%d-%m-%Y").date()
        return v

    @field_validator("delivery_appointment_booked", mode="before")
    @classmethod
    def _yes_no(cls, v):
        if isinstance(v, str):
            s = v.strip().lower()
            if s in ("yes", "y"):
                return True
            if s in ("no", "n"):
                return False
            raise ValueError("must be Yes or No")
        return v

    @model_validator(mode="after")
    def _city_matches_country(self):
        allowed = DESTINATION_CITIES[self.destination_country]
        if self.destination_city not in allowed:
            raise ValueError(
                f"{self.destination_city!r} is not a served city in "
                f"{self.destination_country.value}; choose one of {sorted(allowed)}"
            )
        return self
