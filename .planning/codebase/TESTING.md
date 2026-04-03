# Testing Patterns

**Analysis Date:** 2026-04-02

## Test Framework

**Backend (Python):**
- Runner: `pytest` with `pytest-asyncio`
- Async support: `@pytest.mark.asyncio` on every async test function
- In-memory DB: `sqlite+aiosqlite://` or `sqlite+aiosqlite:///:memory:` for isolation
- HTTP client for integration: `httpx.AsyncClient` with `ASGITransport`
- Config: no `pytest.ini` or `pyproject.toml` — relies on pytest defaults

**Frontend (TypeScript):**
- Runner: `vitest` v4 with `jsdom` environment
- React plugin: `@vitejs/plugin-react`
- Config: `memelab/vitest.config.ts`
- Test utilities: `@testing-library/react` (installed, not yet used in active tests)
- Path alias `@/` resolved in vitest config

**Run Commands:**
```bash
# Python tests (from repo root)
pytest tests/                     # All tests
pytest tests/test_auth.py         # Single file
pytest -k "credit"                # Tests matching pattern

# Frontend tests (from memelab/)
npm run lint                       # ESLint check (no test runner alias exists yet)
npx vitest                         # Run tests
npx vitest --run                   # Single pass (CI mode)
```

## Test File Organization

**Python:**
- All tests in `tests/` directory at repo root
- One file per domain/feature (e.g., `test_credit_service.py`, `test_auth.py`, `test_tenant.py`)
- `tests/__init__.py` present (empty — makes it a package)

**TypeScript:**
- Tests in `memelab/src/__tests__/` directory
- All files are `*.test.{ts,tsx}` matching `src/__tests__/**/*.test.{ts,tsx}` (per vitest config)
- Currently 3 files: `use-usage.test.ts`, `usage-widget.test.tsx`, `source-badges.test.tsx`

**Naming:**
- Python: `test_<domain_or_feature>.py` (e.g., `test_credit_service.py`, `test_video_prompt_builder.py`)
- TypeScript: `<feature>.test.{ts,tsx}` (e.g., `use-usage.test.ts`, `usage-widget.test.tsx`)

## Python Test Structure

**Suite organization by feature group:**
```python
# Task-based groups with comment headers
# -- Task 1: Schema & cost helper tests --
def test_api_usage_cost_brl_column(): ...
def test_compute_cost_brl_from_config(): ...

# -- Task 2: Repository, endpoint, and response model tests --
async def test_credits_summary_schema(): ...
```

**Class-based grouping for TENANT tests:**
```python
class TestUserIsolation:
    """TENANT-01: Regular user only sees their own characters."""

    @pytest.mark.asyncio
    async def test_user_isolation(self, regular_user, admin_character, user_character): ...

class TestAdminBypass:
    """TENANT-03: Admin user sees all characters."""
    ...
```

**Fixture scoping:**
- Most fixtures are function-scoped (default)
- DB setup fixtures use `autouse=True` for integration tests
- `@pytest_asyncio.fixture` for async fixtures

## Python Mocking Patterns

Mock-heavy unit tests (no DB needed):
```python
from unittest.mock import AsyncMock, MagicMock, patch

def _mock_session_for_list(characters: list) -> AsyncMock:
    """Create a mock AsyncSession that returns a list of characters."""
    session = AsyncMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = characters
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    session.execute.return_value = result_mock
    return session

def _mock_session_for_scalar(character) -> AsyncMock:
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = character
    session.execute.return_value = result_mock
    return session
```

Used in `tests/test_tenant.py` to test repository-level tenant isolation without DB.

External API mocking with `patch`:
```python
with patch("src.services.key_selector.UsageRepository") as MockRepo:
    MockRepo.return_value.check_limit = AsyncMock(return_value=(True, {...}))
    result = await selector.resolve(user_id=1, session=mock_session)
```

`SimpleNamespace` for lightweight domain objects (no ORM overhead):
```python
def _make_user(user_id: int, role: str = "user") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role=role, email=f"user{user_id}@test.com")
```

## Python In-Memory DB Fixtures

Two patterns exist depending on test type:

**Pattern 1 — autouse for full integration tests (test_auth.py):**
```python
@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create tables in in-memory SQLite for each test."""
    sess_mod._engine = None        # reset singleton
    sess_mod._session_factory = None
    await init_db()
    yield
    engine = get_engine()
    await engine.dispose()
    sess_mod._engine = None
    sess_mod._session_factory = None

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

**Pattern 2 — explicit fixture for service/repo tests (test_credit_service.py):**
```python
@pytest_asyncio.fixture
async def async_session():
    from src.database.base import Base
    import src.database.models  # noqa: F401  # needed to register tables

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()
```

**Important:** env vars must be set BEFORE app imports to avoid connection errors:
```python
# test_auth.py — set at top of file before any imports
os.environ["SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"
```

## Python Test Categories

**Schema validation tests (pure unit, no DB):**
Import ORM models and inspect `__table__.columns` directly:
```python
def test_user_credit_model_fields():
    from src.database.models import UserCredit
    table = UserCredit.__table__
    cols = {c.name: c for c in table.columns}
    assert "user_id" in cols
    assert isinstance(cols["balance"].type, Integer)
```

**Config function tests (pure unit, no DB):**
```python
def test_compute_cost_brl_from_config():
    from config import compute_video_cost_brl
    assert compute_video_cost_brl("hailuo/2-3-image-to-video-standard", 10) == 2.62
```

**Service tests (async, in-memory DB):**
Use `async_session` + domain fixture:
```python
async def test_check_and_deduct_sufficient_balance(async_session, user_with_credits):
    from src.services.credit_service import CreditService
    svc = CreditService(async_session)
    consumed = await svc.check_and_deduct(
        user_id=user_with_credits.id,
        model_id="hailuo/2-3-image-to-video-standard",
        duration=6,
        job_type="video",
        job_id="test-job-1",
    )
    assert consumed == 21
```

**HTTP integration tests (async, full app with in-memory DB):**
```python
@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    assert resp.json()["email"] == "test@example.com"
    assert "password" not in resp.json()
```

**Introspection tests (inspect-based, no DB):**
Check method signatures and source for contract validation:
```python
def test_increment_signature():
    from src.database.repositories.usage_repo import UsageRepository
    sig = inspect.signature(UsageRepository.increment)
    params = list(sig.parameters.keys())
    assert "cost_brl" in params
    assert sig.parameters["cost_brl"].default == 0.0
```

```python
def test_business_metrics_videos_generated_schema():
    import ast
    source = inspect.getsource(UsageRepository.get_business_metrics)
    assert "videos_generated" in source
    assert "current" in source
```

## TypeScript Test Structure

Current frontend tests are nearly all stubs (`it.todo`). The structure is established but coverage is minimal:

```typescript
// memelab/src/__tests__/use-usage.test.ts
import { describe, it, expect } from "vitest";

describe("useUsage hook", () => {
  it.todo("calls getUsage API function");
  it.todo("polls with 30s refresh interval");
});
```

```typescript
// memelab/src/__tests__/usage-widget.test.tsx
describe("Usage Widget", () => {
  it.todo("renders usage card with service rows");
  it.todo("shows progress bar with emerald color when usage < 60%");
  // ...
});
```

No implemented frontend tests exist yet. The testing infrastructure is wired up (vitest + jsdom + @testing-library/react) but no tests pass assertions.

## Coverage

**Python:**
- No coverage enforcement or target configured
- No `--cov` flag in any documented run command

**Frontend:**
- No coverage configured in `memelab/vitest.config.ts`

## What Gets Tested (Python)

| Domain | Test File | What's Covered |
|--------|-----------|----------------|
| Auth | `tests/test_auth.py` | Full HTTP: register, login, refresh, logout, /me |
| Credits | `tests/test_credit_service.py` | CreditService: deduct, refund, top-up, balance |
| Credits | `tests/test_credits.py` | Schema: ApiUsage columns, VideoCreditsResponse, costs |
| Tenant isolation | `tests/test_tenant.py` | CharacterRepository: user filter, admin bypass, 403 |
| API usage | `tests/test_api_usage.py` | ApiUsage model schema, unique constraints |
| Key selector | `tests/test_key_selector.py` | UsageAwareKeySelector: free/paid key logic |
| Dashboard | `tests/test_dashboard_metrics.py` | UsageRepository.get_business_metrics() contract |
| Video prompt | `tests/test_video_prompt_builder.py` | Prompt building logic |
| Legend | `tests/test_legend_config.py`, `test_legend_renderer.py`, `test_legend_worker.py` | Legend rendering |
| Preconditions | `tests/test_preconditions.py` | CORS, Gemini model discovery, health endpoint |
| Atomic counter | `tests/test_atomic_counter.py` | Thread-safe counter |
| Static fallback | `tests/test_static_fallback.py` | Static background fallback |
| Users | `tests/test_users_table.py` | User model schema |

## Test Coverage Gaps

**Frontend:**
- All 3 test files are `it.todo` stubs — zero implemented tests
- No tests for any SWR hook behavior, component rendering, API client, or auth flow
- Files: `memelab/src/__tests__/use-usage.test.ts`, `usage-widget.test.tsx`, `source-badges.test.tsx`

**Backend:**
- No tests for `/reels/*` routes (interactive pipeline step approval)
- No tests for `/ads/*` routes (product ad wizard)
- No tests for billing/Stripe integration (`src/api/routes/billing.py`)
- No tests for publishing queue (`src/api/routes/publishing.py`)
- No tests for character generation routes (DNA/profile generation via Gemini)
- No tests for video generation routes (`src/api/routes/video.py`) beyond schema validation

---

*Testing analysis: 2026-04-02*
