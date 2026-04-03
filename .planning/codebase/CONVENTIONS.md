# Coding Conventions

**Analysis Date:** 2026-04-02

## Naming Patterns

**Files:**
- Python modules: `snake_case.py` (e.g., `credit_service.py`, `usage_repo.py`)
- TypeScript pages: `page.tsx` inside route directories (Next.js App Router convention)
- TypeScript hooks: `use-kebab-case.ts` (e.g., `use-api.ts`, `use-reels.ts`)
- TypeScript components: `kebab-case.tsx` (e.g., `step-prompt.tsx`, `step-assembly.tsx`)

**Functions:**
- Python: `snake_case` for all functions and methods (e.g., `check_and_deduct`, `get_by_slug`)
- TypeScript: `camelCase` for functions and handlers (e.g., `handleTopUp`, `formatDate`, `formatCost`)
- React components: `PascalCase` (e.g., `CharacterCard`, `LoadingSkeleton`, `EmptyState`)

**Variables:**
- Python: `snake_case` throughout
- TypeScript: `camelCase` for local state and variables
- Configuration/label maps: `SCREAMING_SNAKE_CASE` constants (e.g., `TYPE_LABELS`, `STATUS_BADGE`, `STEP_LABELS`)

**Types / Interfaces:**
- TypeScript interfaces: `PascalCase` exported from `memelab/src/lib/api.ts` (e.g., `CharacterSummary`, `VideoListItem`)
- Python Pydantic models: `PascalCase` with suffix `Request`, `Response`, or plain noun (e.g., `CharacterCreateRequest`, `VideoStatusResponse`, `CreditLog`)
- Python ORM models: `PascalCase` nouns matching table domain (e.g., `Character`, `UserCredit`, `CreditLog`)

## Code Style

**Formatting:**
- Python: no formatter config detected (no Black/Ruff config); consistent 4-space indentation throughout
- TypeScript: no Prettier config detected; Next.js ESLint (`eslint-config-next`) is the only linting tool
- TypeScript strict mode enabled (`"strict": true` in `memelab/tsconfig.json`)

**Linting:**
- Frontend: Next.js ESLint only (`npm run lint` in `memelab/`)
- Python: no linting config found; style enforced by convention

## Import Organization

**Python order:**
1. Standard library (e.g., `asyncio`, `logging`, `uuid`)
2. Third-party (e.g., `fastapi`, `sqlalchemy`, `pydantic`)
3. Internal — grouped by layer: `src.api.deps` → `src.database.models` → `src.services.*`

**TypeScript order:**
1. React/Next.js (`react`, `next/navigation`, `next/link`)
2. Third-party UI (`lucide-react`, `framer-motion`, `swr`)
3. Internal — path-aliased with `@/` prefix:
   - `@/components/ui/*` — primitives
   - `@/components/<domain>/*` — feature components
   - `@/hooks/use-api`, `@/hooks/use-reels`, `@/hooks/use-ads`
   - `@/lib/api`, `@/lib/utils`, `@/lib/constants`
   - `@/contexts/*`

**Path Aliases:**
- `@/*` maps to `memelab/src/*` (defined in `memelab/tsconfig.json`)

## API Route Pattern (FastAPI)

Every route module follows the same structure:

```python
# 1. Module docstring describing routes and phase decision references
"""Domain API routes — description.
Per D-XX: design decision reference.
"""
# 2. Standard imports
# 3. logger = logging.getLogger("clip-flow.api.<domain>")
# 4. router = APIRouter(prefix="/<domain>", tags=["Domain Name"])
# 5. Helper functions prefixed with _ (e.g., _get_user_job, _calc_progress)
# 6. Route handlers
```

Auth dependency is applied to every protected endpoint:
```python
@router.get("/balance")
async def get_balance(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
):
    ...
```

All protected routes import from `src.api.deps`:
```python
from src.api.deps import db_session, get_current_user
```

## Auth Pattern (Frontend)

All authenticated pages live under `memelab/src/app/(app)/`. The `(app)/layout.tsx` guards the entire route group using `useAuth()`:

```tsx
const { isAuthenticated, isLoading } = useAuth();
// Redirects to /login if not authenticated
```

Token storage: `localStorage` (persist) or `sessionStorage` (session-only) based on `rememberMe`. The `request<T>()` function in `memelab/src/lib/api.ts` reads both storages and attaches `Authorization: Bearer <token>`. On 401, tokens are cleared and the page redirects to `/login`.

The `useAuth()` hook is sourced from `memelab/src/contexts/auth-context.tsx`.

## Session Management (Backend)

Background tasks that need DB access must create their own session via `get_session_factory()` — never pass the request-scoped session from `Depends(db_session)`:

```python
# Per Phase 999.1 pattern (documented in src/api/routes/reels.py)
from src.database.session import get_session_factory
async with get_session_factory()() as session:
    ...
```

## Error Handling

**Python — API layer:**
- `HTTPException(status_code=4xx, detail="...")` for all client errors
- 401: missing/invalid JWT; 403: ownership violation; 404: not found; 409: duplicate
- `PermissionError` raised in repository; converted to 403 by `get_user_character()` in `src/api/deps.py`
- `InsufficientCreditsError` raised by `CreditService`; callers catch and return 402/403

**Python — service/repo layer:**
- Raises `ValueError` (e.g., duplicate email), `PermissionError` (wrong owner), domain exceptions (`InsufficientCreditsError`)
- Does NOT raise `HTTPException` — reserved for API routes only

**TypeScript — API calls:**
- `request<T>()` in `memelab/src/lib/api.ts` throws `Error("API ${status}: ${text}")` for non-2xx responses
- Pages wrap mutations in `try/catch` with local error state
- 401 triggers automatic redirect to `/login` (handled inside `request()`)

## Logging

Logger name convention: `clip-flow.api` (root), `clip-flow.api.reels`, `clip-flow.api.video`, `clip-flow.auth` — hierarchical by domain.

```python
logger = logging.getLogger("clip-flow.api.<domain>")
logger.info("Normal operation")
logger.error("Failure only — not for expected validation errors")
```

No structured logging — plain `%(asctime)s [%(name)s] %(levelname)s: %(message)s` format.

## Comments and Docstrings

- Module docstrings on every `src/api/routes/*.py` file listing endpoints and phase decision refs
- Phase reference format: `# Per D-XX:` or `# Phase 999.1 pattern:`
- Class/method docstrings on service classes (`CreditService`, `AuthService`)
- Inline comments only where logic is non-obvious; no docstrings on route handler functions

## Frontend Component Structure

Every page component follows this layout:

```tsx
"use client";

// 1. Named sub-components (EmptyState, LoadingSkeleton, ItemCard) — defined first
// 2. Default export: the Page component
export default function DomainPage() {
  // SWR hooks at top
  const { data, isLoading } = useDomainHook();
  // Local state below hooks
  const [selected, setSelected] = useState(...);

  return (
    <div className="space-y-6">
      {/* Page header: icon + h1 + subtitle description */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Title</h1>
          <p className="text-sm text-muted-foreground">Subtitle</p>
        </div>
      </div>
      {/* Content — three-state pattern */}
      {isLoading ? <LoadingSkeleton /> : !data?.length ? <EmptyState /> : <DataGrid />}
    </div>
  );
}
```

## Per-Domain Conventions

**Characters (`/characters/*`, `src/api/routes/characters.py`):**
- Tenant-isolated via `user_id` FK; repository raises `PermissionError` for cross-tenant access
- `get_user_character()` helper in `src/api/deps.py` wraps 403/404 pattern for all character sub-routes
- Status values: `draft` | `refining` | `ready` — mapped to PT-BR labels in `STATUS_CONFIG` on frontend

**Videos (`/generate/video`, `src/api/routes/video.py`):**
- Credit-gated: calls `CreditService.check_and_deduct()` before submitting to Kie.ai API
- Background tasks use `get_session_factory()` pattern, not request session
- Stale job scanner runs in background thread via `src/video_gen/stale_job_scanner.py`

**Reels (`/reels/*`, `src/api/routes/reels.py`):**
- Interactive step-based pipeline; step state JSON stored in `ReelsJob.step_state`
- Each step: `status: pending | generating | approved | error`
- Frontend polls `useStepState(jobId)` at 2s interval

**Ads (`/ads/*`, `src/api/routes/ads.py`):**
- Same approve/regenerate pattern as reels (documented "Per D-20")
- 8 steps; export step auto-completes without approval ("Per D-22")
- Module-level helpers `_init_step_state()`, `_calc_progress()`, `_get_user_job()` follow `_` prefix

**Credits (`/credits`, `src/api/routes/credits.py`, `src/services/credit_service.py`):**
- Every credit mutation logs a `CreditLog` entry — fully auditable
- `balance_after` stored on each log row (no need to reconstruct from history)
- Admin-only operations check `current_user.role != "admin"` → 403

## SWR Cache Key Convention

Cache keys are deterministic strings constructed from parameters — never `JSON.stringify`:

```typescript
// Correct
const key = `drive-images-${query?.theme ?? ""}-${query?.limit ?? 20}`;

// Null/disabled pattern for conditional fetching
return useSWR(slug ? `character-${slug}` : null, ...);
```

## PT-BR UI Labels

All user-facing text in the frontend is Portuguese (Brazil): status labels, button text, table headers, error messages, empty states. Backend-facing values (API keys, model IDs, route names, JSON field names) remain in English.

Pattern from `memelab/src/app/(app)/credits/page.tsx`:
```typescript
const TYPE_LABELS: Record<string, string> = {
  deduction: "Deducao",
  refund: "Reembolso",
  top_up: "Recarga",
  blocked: "Bloqueado",
};
```

## Status/Color Mapping Pattern

Both frontend and backend use `Record<string, { label, color }>` objects for status display. Tailwind classes use `bg-*/20 text-* border-*/30` for "pill" badges:

```typescript
const STATUS_CONFIG = {
  draft:  { label: "Rascunho", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  ready:  { label: "Pronto",   color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};
```

Color semantics (consistent across all domains):
- amber/yellow: warning, pending, draft
- emerald/green: success, ready, complete
- blue: in-progress, generating
- red: error, failed, deduction
- purple: interactive mode

## Module Exports

- Python: no explicit `__all__`; direct imports by consumers
- TypeScript: named exports for utilities, types, and hooks; default export for page/component files
- No barrel files (no `index.ts` re-exporting from directories in `components/` or `hooks/`)

---

*Convention analysis: 2026-04-02*
