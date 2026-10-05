from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.request_logging import SafeRequestLogging
from app.auth.router import router as auth_router
from app.services.router import router as services_router
from app.barbers.router import router as barbers_router
from app.business_hours.router import router as hours_router
from app.clients.router import router as clients_router
from app.appointments.router import router as appointments_router

from app.availability.router import router as availability_router
from app.feedback.router import router as feedback_router
from app.products.router import router as products_router
from app.inventory.router import router as inventory_router

from app.public.router import router as public_router

settings = get_settings()
app = FastAPI(title="Project foundation")
app.add_middleware(SafeRequestLogging, sanitize_errors=settings.app_env == "production")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.frontend_origin).rstrip("/")],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

app.include_router(public_router)
app.include_router(availability_router)
app.include_router(feedback_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(auth_router)
app.include_router(services_router)
app.include_router(barbers_router)
app.include_router(hours_router)
app.include_router(clients_router)
app.include_router(appointments_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
