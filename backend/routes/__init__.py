from .orgs import router as orgs_router
from .auth import router as auth_router
from .users import router as users_router
from .fees import router as fees_router
from .billing import router as billing_router
from .classes import router as classes_router
from .students import router as students_router
from .webhooks import router as webhooks_router
from services.whatsapp import router as whatsapp_router


__all__ = [
    "orgs_router",
    "auth_router",
    "users_router",
    "fees_router",
    "billing_router",
    "classes_router",
    "students_router",
    "webhooks_router",
    "whatsapp_router",
]
