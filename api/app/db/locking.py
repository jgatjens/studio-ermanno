from sqlalchemy import select
from app.db.models import Business


def lock_business(session, business_id):
    """Shared PostgreSQL lock for scheduling and catalog/hour writers."""
    return session.scalar(
        select(Business)
        .where(Business.id == business_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
