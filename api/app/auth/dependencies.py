from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.tokens import unauthorized, validate_access_token
from app.db.models import AdminMembership, Business, MembershipRole
from app.db.session import get_session

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedActor:
    auth_user_id: UUID
    membership_id: UUID
    business_id: UUID
    role: MembershipRole


def require_auth_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    return validate_access_token(credentials.credentials)


def require_authenticated_actor(
    auth_user_id: UUID = Depends(require_auth_user),
    session: Session = Depends(get_session),
) -> AuthenticatedActor:
    memberships = session.scalars(
        select(AdminMembership)
        .join(Business, AdminMembership.business_id == Business.id)
        .where(AdminMembership.auth_user_id == auth_user_id)
        .limit(2)
    ).all()
    # No tenant selector in this single-business MVP; ambiguity is denied.
    if len(memberships) != 1 or memberships[0].role not in (
        MembershipRole.OWNER,
        MembershipRole.STAFF,
    ):
        raise HTTPException(403, "Admin access denied")
    membership = memberships[0]
    return AuthenticatedActor(auth_user_id, membership.id, membership.business_id, membership.role)


def require_owner(
    actor: AuthenticatedActor = Depends(require_authenticated_actor),
) -> AuthenticatedActor:
    if actor.role != MembershipRole.OWNER:
        raise HTTPException(403, "Owner access required")
    return actor
