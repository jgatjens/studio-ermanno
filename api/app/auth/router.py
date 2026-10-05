from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import AuthenticatedActor, require_authenticated_actor, require_owner
from app.auth.visibility import ClientVisibilityData, ClientVisitData, visible_client
from app.db.models import MembershipRole

router = APIRouter(prefix="/auth", tags=["auth"])


class ActorResponse(BaseModel):
    auth_user_id: UUID
    membership_id: UUID
    business_id: UUID
    role: MembershipRole


@router.get("/me", response_model=ActorResponse)
def me(actor: AuthenticatedActor = Depends(require_authenticated_actor)):
    return ActorResponse(**vars(actor))


@router.get("/test-read")
def test_read(actor: AuthenticatedActor = Depends(require_authenticated_actor)):
    return {"status": "ok"}


@router.post("/test-owner")
def test_owner(actor: AuthenticatedActor = Depends(require_owner)):
    # Authorization probe only; no mutations or domain workflow.
    return {"status": "ok"}


@router.get("/test-client-visibility")
def test_client_visibility(actor: AuthenticatedActor = Depends(require_authenticated_actor)):
    # Synthetic fixture only; no real client lookup or CRUD.
    data = ClientVisibilityData(
        name="Sample Client", email="client@example.test", phone="+390000000000",
        private_notes="Synthetic private notes", visit_notes="Synthetic visit notes",
        appointment_history=[ClientVisitData(services=["Haircut"], products_used=["Pomade"],
            appointment_notes="Synthetic appointment notes", visit_notes="Synthetic visit notes")],
    )
    return visible_client(data, actor)
