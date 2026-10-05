from fastapi import HTTPException
from sqlalchemy import select, func
from app.core.config import get_settings
from app.db.models import Feedback, FeedbackStatus, MembershipRole, Business
from app.db.locking import lock_business


def public_business(session):
    identifier = get_settings().public_business_id
    if identifier is None or session.get(Business, identifier) is None:
        raise HTTPException(503, "Public feedback is not configured")
    return identifier


def submit(session, data):
    try:
        row = Feedback(
            business_id=public_business(session),
            **data.model_dump(),
            status=FeedbackStatus.PENDING,
            is_public=False,
        )
        session.add(row)
        session.commit()
        return dict(status="received")
    except Exception:
        session.rollback()
        raise


def projection(row, actor=None):
    result = dict(name=row.name, rating=row.rating, comment=row.comment, created_at=row.created_at)
    if actor is not None:
        result.update(
            id=row.id,
            status=row.status,
            is_public=row.is_public,
            updated_at=row.updated_at,
            client_id=row.client_id,
            appointment_id=row.appointment_id,
        )
        if actor.role == MembershipRole.OWNER:
            result["email"] = row.email
    return result


def listing(session, limit, offset, actor=None, status=None):
    business_id = actor.business_id if actor else public_business(session)
    filters = [Feedback.business_id == business_id]
    if actor is None:
        filters.extend([Feedback.status == FeedbackStatus.APPROVED, Feedback.is_public.is_(True)])
    elif status is not None:
        filters.append(Feedback.status == status)
    total = session.scalar(select(func.count()).select_from(Feedback).where(*filters))
    rows = session.scalars(
        select(Feedback)
        .where(*filters)
        .order_by(Feedback.created_at.desc(), Feedback.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return dict(
        items=[projection(row, actor) for row in rows], total=total, limit=limit, offset=offset
    )


def scoped(session, actor, identifier):
    row = session.scalar(
        select(Feedback).where(Feedback.id == identifier, Feedback.business_id == actor.business_id)
    )
    if row is None:
        raise HTTPException(404, "Feedback not found")
    return row


def moderate(session, actor, identifier, data):
    try:
        lock_business(session, actor.business_id)
        row = scoped(session, actor, identifier)
        row.status, row.is_public = data.status, data.is_public
        session.commit()
        return projection(row, actor)
    except Exception:
        session.rollback()
        raise
