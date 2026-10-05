"""Explicit client read projection for the two MVP roles; no generic permissions system."""
from typing import Optional
from pydantic import BaseModel, Field

from app.auth.dependencies import AuthenticatedActor
from app.db.models import MembershipRole


class ClientVisitData(BaseModel):
    services: list[str]
    products_used: list[str]
    appointment_notes: Optional[str] = None
    visit_notes: Optional[str] = None


class ClientVisibilityData(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    private_notes: Optional[str] = None
    visit_notes: Optional[str] = None
    appointment_history: list[ClientVisitData] = Field(default_factory=list)


def visible_client(data: ClientVisibilityData, actor: AuthenticatedActor) -> dict:
    if actor.role == MembershipRole.OWNER:
        return data.model_dump()
    # Allowlist both levels: future internal fields cannot leak to Staff by default.
    return {
        "name": data.name,
        "appointment_history": [
            {"services": visit.services, "products_used": visit.products_used,
             "appointment_notes": visit.appointment_notes}
            for visit in data.appointment_history
        ],
    }
