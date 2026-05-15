from .orgs import router as orgs_router
from .auth import router as auth_router
from .users import router as users_router
from .classes import router as classes_router
from .students import router as students_router

__all__ = ["orgs_router", "auth_router", "users_router", "classes_router", "students_router"]