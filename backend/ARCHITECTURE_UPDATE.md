# Backend Architecture Update

## Overview

This document is both the plan and the execution log for refactoring the backend from
its current tangled state into a clean, layered architecture. Each phase is self-contained
and ends with a verification step so nothing can silently break.

---

## Problems in the Current State

| # | Problem | Location |
|---|---|---|
| 1 | `routes/payments.py` is a Nomba API client, not an HTTP route file | `routes/` |
| 2 | `services/whatsapp.py` defines a `FastAPI` `APIRouter` — a route living inside services | `services/` |
| 3 | All 13 SQLAlchemy models packed into one 320-line file | `app/models.py` |
| 4 | `os.getenv()` and `load_dotenv()` scattered across 6+ files | everywhere |
| 5 | `schemas/` imports from `services/` — wrong direction in the dependency chain | `schemas/orgs.py`, `students.py`, `users.py`, `fees.py` |
| 6 | `send_verification_email_task` copy-pasted in both `routes/auth.py` and `routes/orgs.py` | both files |
| 7 | `_format_currency()` defined in both `email_templates.py` and `notifications.py` | both files |
| 8 | Business logic helpers (`get_next_serial`, `sync_invoice_status`, etc.) inside route handlers | `routes/students.py`, `billing.py` |
| 9 | `sys.path` hack at the top of `app/main.py` | `app/main.py` |

---

## Target Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # app factory + CORS + router registration only
│   ├── config.py            # NEW — pydantic-settings, single source of truth
│   ├── database.py          # engine + SessionLocal + get_db
│   ├── security.py          # JWT, hashing, AuthContext, RoleChecker
│   └── models/              # SPLIT — one file per domain
│       ├── __init__.py      # re-exports Base + every model (Alembic finds them here)
│       ├── base.py          # declarative_base() only
│       ├── org.py           # Organization, BankSettlement
│       ├── user.py          # User, UserRole
│       ├── student.py       # Student, Parent, SchoolClass, student_parents
│       ├── billing.py       # FeeTemplate, FeeLineItem, Invoice, InvoiceDetail
│       └── payment.py       # Transaction, PaymentLedger, WebhookLog, NotificationLog
│
├── routes/                  # HTTP layer only — request/response, auth deps, delegation
│   ├── __init__.py
│   ├── auth.py
│   ├── orgs.py
│   ├── users.py
│   ├── classes.py
│   ├── students.py
│   ├── fees.py
│   ├── billing.py
│   ├── webhooks.py
│   └── whatsapp.py          # MOVED from services/whatsapp.py
│
├── schemas/                 # Pydantic contracts — imports only from core, never from services
│   ├── __init__.py
│   ├── orgs.py
│   ├── users.py
│   ├── classes.py
│   ├── students.py
│   ├── fees.py
│   └── webhooks.py
│
├── services/                # Business logic + external integrations
│   ├── __init__.py
│   ├── nomba.py             # MOVED from routes/payments.py
│   ├── notifications.py
│   ├── email_templates.py
│   ├── utils.py             # email senders + re-exports from core.strings
│   └── whatsapp_ai.py       # Gemini client + AI helpers (router moved to routes/)
│
├── core/                    # NEW — pure utility functions, zero app imports
│   ├── __init__.py
│   └── strings.py           # sanitize_text, normalize_phone, generate_short_code
│
├── migrations/
├── tests/
│   ├── test_config.py        # NEW
│   ├── test_core_strings.py  # NEW
│   ├── test_models_import.py # NEW
│   ├── test_nomba_auth.py    # UPDATED import paths
│   ├── test_nomba_webhooks.py# UPDATED import paths
│   └── test_student_contacts.py
├── tools/
├── alembic.ini
├── env.example
└── requirements.txt
```

---

## Dependency Direction Rule

Every import must flow **downward only**. Nothing ever imports upward.

```
routes/          ← HTTP concerns only
    ↓
services/        ← business logic, external API wrappers
    ↓
app/models/      ← SQLAlchemy ORM
    ↓
core/            ← pure Python utilities
    ↓
app/config.py    ← settings, no other app imports
```

`schemas/` sits beside services — it imports from `core/` only, never from `services/`.

---

## Phases

### Phase 1 — Centralize configuration (`app/config.py`)

**What changes:**
- Create `app/config.py` with a `pydantic-settings` `Settings` class covering every env var.
- Remove `load_dotenv()` calls from `app/database.py`, `app/security.py`,
  `services/utils.py`, and `services/notifications.py`.
- Replace all `os.getenv("VAR")` module-level reads with `get_settings().field`.

**Files touched:** `app/config.py` (new), `app/database.py`, `app/security.py`

**Verification:**
```bash
cd backend && python -c "from app.config import get_settings; s = get_settings(); print(s.algorithm)"
# expected: HS256
```

---

### Phase 2 — Create `core/` utilities layer

**What changes:**
- Create `core/__init__.py` and `core/strings.py`.
- Move the five pure string functions out of `services/utils.py` into `core/strings.py`:
  `sanitize_text`, `sanitize_short_code`, `sanitize_email`,
  `normalize_phone_number`, `generate_short_code`.
- `services/utils.py` re-exports them from `core.strings` so no callers break yet.

**Files touched:** `core/` (new), `services/utils.py`

**Verification:**
```bash
cd backend && python -c "from core.strings import normalize_phone_number; print(normalize_phone_number('08012345678'))"
# expected: +2348012345678
```

---

### Phase 3 — Fix layer violations in schemas

**What changes:**
- `schemas/orgs.py`, `schemas/students.py`, `schemas/users.py`, `schemas/fees.py`
  currently do `from services import utils`. Change all of them to
  `from core import strings` (or `from core.strings import ...`).

**Files touched:** all four schema files listed above

**Verification:**
```bash
cd backend && python -c "import schemas"
# must import cleanly with no error
```

---

### Phase 4 — Split `app/models.py` into domain modules

**What changes:**
- Create `app/models/` package with `base.py`, `org.py`, `user.py`,
  `student.py`, `billing.py`, `payment.py`.
- Create `app/models/__init__.py` that re-exports everything so that
  `from app.models import X` still works everywhere without touching a single
  other file.
- Delete `app/models.py` only after confirming all imports resolve.

**Files touched:** `app/models/` (new), `app/models.py` (deleted)

**Verification:**
```bash
cd backend && python -m pytest tests/test_models_import.py -v
```

---

### Phase 5 — Move misplaced files

#### 5a — `routes/payments.py` → `services/nomba.py`

**What changes:**
- Create `services/nomba.py` with the same content as `routes/payments.py`.
- Update the one internal import (`from services.utils import FRONTEND_URL`
  stays — relative path changes to `from .utils import FRONTEND_URL`).
- Update all callers:
  - `routes/billing.py`: `from . import payments` → `from services import nomba`
  - `routes/webhooks.py`: same
  - `routes/orgs.py`: same
  - `services/whatsapp.py` (nested import): `import routes.payments as payments`
    → `from services import nomba`
- Delete `routes/payments.py`.

#### 5b — `services/whatsapp.py` → split into `services/whatsapp_ai.py` + `routes/whatsapp.py`

**What changes:**
- Create `services/whatsapp_ai.py` with: Gemini client init, `ai_client`,
  `conversation_sessions`, `SYSTEM_INSTRUCTION`, `_debug`, `_log_exception`,
  `_classify_gemini_error`, `_call_gemini`.
- Create `routes/whatsapp.py` with: the `APIRouter` and the
  `whatsapp_assistant_webhook` handler (importing its AI helpers from
  `services.whatsapp_ai`).
- Update `routes/__init__.py` to import `whatsapp_router` from `routes.whatsapp`
  instead of `services.whatsapp`.
- Delete `services/whatsapp.py`.

**Files touched:** `services/nomba.py` (new), `services/whatsapp_ai.py` (new),
`routes/whatsapp.py` (new), `routes/__init__.py`, `routes/billing.py`,
`routes/webhooks.py`, `routes/orgs.py`, `routes/payments.py` (deleted),
`services/whatsapp.py` (deleted)

**Verification:**
```bash
cd backend && python -m pytest tests/test_nomba_auth.py tests/test_nomba_webhooks.py -v
```

---

### Phase 6 — Remove duplicated code

**What changes:**
- Remove `send_verification_email_task` from `routes/auth.py` and
  `routes/orgs.py`. Add `send_verification_email_background_task` to
  `services/utils.py` and import it in both route files.
- Remove duplicate `_format_currency` from `services/notifications.py`;
  import it from `services.email_templates` instead.

**Files touched:** `routes/auth.py`, `routes/orgs.py`, `services/utils.py`,
`services/notifications.py`

**Verification:**
```bash
cd backend && python -c "from services.utils import send_verification_email_background_task; print('ok')"
```

---

### Phase 7 — Remove `sys.path` hack from `app/main.py`

**What changes:**
- Delete the `BACKEND_ROOT / sys.path` block from `app/main.py`.
- Confirm uvicorn is run from the `backend/` directory (standard practice).

**Files touched:** `app/main.py`

**Verification:**
```bash
cd backend && python -c "from app.main import app; print(app.title)"
# expected: ṣilẹti API
```

---

### Phase 8 — Add new tests

Three new test files cover the new foundation layers:

| File | What it tests |
|---|---|
| `tests/test_config.py` | Settings defaults, field types, `get_settings()` caching |
| `tests/test_core_strings.py` | All five string utilities, phone normalization edge cases |
| `tests/test_models_import.py` | All models importable from new package, Base.metadata table names |

---

## Running All Tests

```bash
# from backend/
python -m pytest tests/ -v
```

Expected passing tests after full migration:

- `tests/test_config.py`              — new
- `tests/test_core_strings.py`        — new
- `tests/test_models_import.py`       — new
- `tests/test_nomba_auth.py`          — updated import paths
- `tests/test_nomba_webhooks.py`      — updated import paths
- `tests/test_student_contacts.py`    — no change needed

---

## Files Created / Moved / Deleted Summary

| Action | File |
|---|---|
| **Created** | `app/config.py` |
| **Created** | `core/__init__.py` |
| **Created** | `core/strings.py` |
| **Created** | `app/models/__init__.py` |
| **Created** | `app/models/base.py` |
| **Created** | `app/models/org.py` |
| **Created** | `app/models/user.py` |
| **Created** | `app/models/student.py` |
| **Created** | `app/models/billing.py` |
| **Created** | `app/models/payment.py` |
| **Created** | `services/nomba.py` |
| **Created** | `services/whatsapp_ai.py` |
| **Created** | `routes/whatsapp.py` |
| **Created** | `tests/test_config.py` |
| **Created** | `tests/test_core_strings.py` |
| **Created** | `tests/test_models_import.py` |
| **Modified** | `app/main.py` |
| **Modified** | `app/database.py` |
| **Modified** | `app/security.py` |
| **Modified** | `services/utils.py` |
| **Modified** | `services/notifications.py` |
| **Modified** | `schemas/orgs.py` |
| **Modified** | `schemas/students.py` |
| **Modified** | `schemas/users.py` |
| **Modified** | `schemas/fees.py` |
| **Modified** | `routes/__init__.py` |
| **Modified** | `routes/auth.py` |
| **Modified** | `routes/orgs.py` |
| **Modified** | `routes/billing.py` |
| **Modified** | `routes/webhooks.py` |
| **Modified** | `tests/test_nomba_auth.py` |
| **Modified** | `tests/test_nomba_webhooks.py` |
| **Deleted** | `app/models.py` |
| **Deleted** | `routes/payments.py` |
| **Deleted** | `services/whatsapp.py` |
