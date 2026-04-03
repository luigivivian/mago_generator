# Phase 1000: Character-Scoped Navigation - Research

**Researched:** 2026-04-02
**Domain:** React Context propagation, SWR cache keying, FastAPI query parameter filtering
**Confidence:** HIGH

## Summary

The codebase already has most of the infrastructure for character-scoped navigation. A `CharacterContext` exists in `memelab/src/contexts/character-context.tsx` with `activeSlug`, localStorage persistence, and a working `CharacterSelector` dropdown in the sidebar. The gap is that almost no pages consume this context to filter their data. Only the pipeline page and the reels creation form pass `character_slug` to the backend.

On the backend, most DB models already have a `character_id` column (ContentPackage, ReelsJob, Theme, ScheduledPost, BatchJob, PipelineRun). The critical exception is `ProductAdJob` which lacks `character_id` entirely -- this requires a migration. Several listing endpoints already accept `character_id` as a query parameter (content, themes, publishing queue, pipeline runs) while others do not (video list, reel jobs, ad jobs, drive images, dashboard endpoints).

The implementation pattern is straightforward: (1) add `character_slug` query param to backend listing endpoints that lack it, (2) resolve slug to `character_id` on the backend, (3) update SWR hooks to accept `character_slug` and include it in cache keys, (4) consume `useCharacterContext()` in every page and pass `activeSlug` to hooks.

**Primary recommendation:** Propagate the existing `CharacterContext.activeSlug` into every SWR hook's cache key and API call. Backend changes are minimal -- most models already have `character_id`, and the slug-to-id resolution pattern exists in `deps.py`.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Context | 19.x | Global character state | Already exists as `CharacterContext` |
| SWR | 2.x | Data fetching with cache | Already used everywhere -- cache key change = automatic refetch |
| FastAPI Query params | 0.115+ | Filtering endpoints | Already the pattern for `character_id` in content, themes, publishing |
| Alembic | 1.14+ | DB migration for ads | Already used -- 027 migrations exist |

### No new dependencies needed
This phase adds zero new packages. Everything is achieved by wiring existing infrastructure.

## Architecture Patterns

### Existing CharacterContext (already built)

```
memelab/src/contexts/character-context.tsx
```

Provides:
- `characters: CharacterSummary[]` (from `useCharacters` SWR hook)
- `activeSlug: string` (default "mago-mestre")
- `setActiveSlug(slug)` (persists to localStorage with key `clip-flow-active-character`)
- `activeCharacter: CharacterSummary | null` (resolved from `characters` array)

Mounted in `Shell` component (`memelab/src/components/layout/shell.tsx`), which wraps all `(app)/*` pages. Every page already has access.

### Pattern 1: SWR Cache Key with Character Slug

**What:** Include `activeSlug` in every SWR cache key so changing character triggers automatic refetch.
**When to use:** Every listing hook.
**Example:**
```typescript
// BEFORE
export function useVideoGallery(params?: VideoGalleryParams) {
  const key = `video-gallery-${params?.status ?? ""}-...`;
  return useSWR(key, () => api.getVideoList(params));
}

// AFTER
export function useVideoGallery(params?: VideoGalleryParams & { character_slug?: string }) {
  const key = `video-gallery-${params?.character_slug ?? "all"}-${params?.status ?? ""}-...`;
  return useSWR(key, () => api.getVideoList(params));
}
```

SWR re-fetches automatically when the cache key changes. This is the standard SWR pattern for parameterized queries.

### Pattern 2: Backend Slug-to-ID Resolution

**What:** Accept `character_slug` as query param, resolve to `character_id` using existing `get_user_character` helper.
**When to use:** Every listing endpoint that needs character filtering.
**Example:**
```python
@router.get("/list")
async def list_videos(
    character_slug: str | None = Query(default=None),
    # ... existing params ...
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
):
    character_id = None
    if character_slug:
        from src.api.deps import get_user_character
        character = await get_user_character(character_slug, current_user, session)
        character_id = character.id

    stmt = select(ContentPackage).where(ContentPackage.video_status.isnot(None))
    if character_id:
        stmt = stmt.where(ContentPackage.character_id == character_id)
    # ... rest of existing query ...
```

### Pattern 3: Page-Level Context Consumption

**What:** Every page reads `activeSlug` from context and passes it to hooks.
**Example:**
```typescript
// In each page.tsx
import { useCharacterContext } from "@/contexts/character-context";

export default function VideosPage() {
  const { activeSlug } = useCharacterContext();
  const { data } = useVideoGallery({ character_slug: activeSlug });
  // ...
}
```

### Recommended Project Structure (changes only)

```
memelab/src/
  contexts/
    character-context.tsx   # EXISTS — no changes needed
  hooks/
    use-api.ts              # MODIFY — add character_slug to hook params + cache keys
    use-reels.ts            # MODIFY — add character_slug to useReelJobs
    use-ads.ts              # MODIFY — add character_slug to useAdJobs
  lib/
    api.ts                  # MODIFY — add character_slug to API function params
  app/(app)/
    gallery/page.tsx        # MODIFY — consume CharacterContext
    videos/page.tsx         # MODIFY — consume CharacterContext
    themes/page.tsx         # MODIFY — consume CharacterContext
    publishing/page.tsx     # MODIFY — consume CharacterContext
    reels/page.tsx          # MODIFY — already partially uses it for creation, add to listing
    ads/page.tsx            # MODIFY — consume CharacterContext
    dashboard/page.tsx      # MODIFY — consume CharacterContext (optional, lower priority)

src/api/routes/
    video.py                # MODIFY — add character_slug to list_videos
    reels.py                # MODIFY — add character_slug to list_reel_jobs
    ads.py                  # MODIFY — add character_slug to list_ad_jobs
    drive.py                # MODIFY — add character_slug to list_images (filesystem-based, needs redesign)
    dashboard.py            # MODIFY — add character_slug to analytics endpoints

src/database/
    models.py               # MODIFY — add character_id to ProductAdJob
    migrations/versions/     # ADD — migration 028 for ProductAdJob.character_id
```

### Anti-Patterns to Avoid
- **Passing character_id instead of character_slug from frontend:** The frontend knows slugs, not IDs. Always use slug in API calls, resolve to ID on backend.
- **Fetching character list to resolve slug on frontend:** The backend already has `get_user_character(slug, user, session)` in deps.py. Do not duplicate resolution logic.
- **Creating a new provider/context:** CharacterContext already exists and is mounted in Shell. Do not create a second context.
- **Invalidating SWR cache manually on character change:** SWR handles this automatically when the cache key includes `activeSlug`. No need for `mutate()` calls on character switch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Character state management | Custom state + event bus | Existing `CharacterContext` | Already built, tested, has localStorage persistence |
| Cache invalidation on switch | Manual `mutate()` calls | SWR cache key with slug | SWR auto-refetches when key changes |
| Slug-to-ID resolution | Frontend lookup | `get_user_character` in `deps.py` | Backend helper enforces ownership, raises 403/404 |
| Character selector UI | New component | Existing `CharacterSelector` in sidebar.tsx | Already built with animation, collapsed mode, status badges |

**Key insight:** 90% of this phase's infrastructure already exists. The work is wiring, not building.

## Common Pitfalls

### Pitfall 1: Drive Images Are Filesystem-Based (No character_id)
**What goes wrong:** The gallery (`/drive/images`) lists files from `output/backgrounds_generated/` and `assets/backgrounds/`. These files don't have `character_id` in a database -- they're on the filesystem. Filtering by character requires matching filenames to character directories or querying ContentPackage records.
**Why it happens:** Gallery was built before multi-character support. Files are named by theme, not character.
**How to avoid:** For the gallery, filter via ContentPackage table (which HAS `character_id`) instead of raw filesystem. Alternatively, filter by `assets/backgrounds/{character_slug}/` directory.
**Warning signs:** Gallery shows all characters' images regardless of selection.

### Pitfall 2: ProductAdJob Lacks character_id Column
**What goes wrong:** `ProductAdJob` model has no `character_id`. Cannot filter ads by character without a migration.
**Why it happens:** Ads pipeline was built for product ads (tied to a product, not a character). Character scoping was added to ReelsJob but not ProductAdJob.
**How to avoid:** Add `character_id` column via Alembic migration. Make it nullable (existing ads have no character). Set it from frontend on creation.
**Warning signs:** Ads page shows all ads regardless of character selection.

### Pitfall 3: SWR Cache Key Must Include Slug
**What goes wrong:** Changing character in sidebar doesn't trigger data refetch. Old data stays visible.
**Why it happens:** SWR only refetches when the cache key changes. If `activeSlug` is not in the key, switching characters has no effect.
**How to avoid:** Every SWR hook that is character-scoped MUST include `character_slug` in its cache key string.
**Warning signs:** Data doesn't change when switching characters until manual page refresh.

### Pitfall 4: Dashboard Endpoints Join via Character Table
**What goes wrong:** Dashboard queries already use `Character.user_id` for tenant isolation via outerjoin. Adding character_slug filtering requires modifying these existing queries carefully.
**Why it happens:** Dashboard queries are complex aggregations with LEFT JOINs to Character table.
**How to avoid:** Add `character_id` filter as an additional WHERE clause on the existing Character join. Keep the `character_id IS NULL` fallback for legacy data.
**Warning signs:** Dashboard shows 0 counts when character is selected but old data has no character_id.

### Pitfall 5: "All Characters" Option
**What goes wrong:** User has no way to see everything across all characters.
**Why it happens:** If activeSlug always has a value, every page always filters.
**How to avoid:** Support a "Todos os Personagens" option in the selector (null/empty slug). When no character is selected, omit the filter parameter entirely. The existing `CharacterContext` defaults to "mago-mestre" -- consider adding an "all" option.
**Warning signs:** User cannot see their full content library without switching characters one by one.

## Code Examples

### Backend: Adding character_slug to Video List Endpoint

```python
# src/api/routes/video.py — list_videos
@router.get("/list", summary="List content packages with video status")
async def list_videos(
    character_slug: str | None = Query(default=None),  # NEW
    status: str | None = None,
    model: str | None = None,
    sort: str = "newest",
    limit: int = 50,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
):
    stmt = select(ContentPackage).where(ContentPackage.video_status.isnot(None))

    # Character scoping
    if character_slug:
        from src.api.deps import get_user_character
        char = await get_user_character(character_slug, current_user, session)
        stmt = stmt.where(ContentPackage.character_id == char.id)

    # ... existing filters ...
```

### Backend: Adding character_slug to Reel Jobs Endpoint

```python
# src/api/routes/reels.py — list_reel_jobs
@router.get("/jobs", summary="List user's reel jobs")
async def list_reel_jobs(
    character_slug: str | None = Query(default=None),  # NEW
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(db_session),
):
    query = select(ReelsJob).where(ReelsJob.user_id == current_user.id)

    if character_slug:
        from src.api.deps import get_user_character
        char = await get_user_character(character_slug, current_user, db)
        query = query.where(ReelsJob.character_id == char.id)

    if status:
        query = query.where(ReelsJob.status == status)
    # ... rest ...
```

### Frontend: Hook with Character Slug

```typescript
// memelab/src/hooks/use-api.ts
export function useVideoGallery(params?: api.VideoGalleryParams) {
  const key = params
    ? `video-gallery-${params.character_slug ?? "all"}-${params.status ?? ""}-${params.model ?? ""}-${params.sort ?? "newest"}-${params.limit ?? 50}`
    : null;
  return useSWR(key, () => api.getVideoList(params), {
    refreshInterval: 15000,
    errorRetryCount: 1,
  });
}
```

### Frontend: Page Consuming Context

```typescript
// memelab/src/app/(app)/videos/page.tsx
import { useCharacterContext } from "@/contexts/character-context";

export default function VideosPage() {
  const { activeSlug } = useCharacterContext();
  // Pass activeSlug to hook — SWR auto-refetches on character switch
  const { data } = useVideoGallery({
    character_slug: activeSlug || undefined,
    // ... existing params ...
  });
  // ...
}
```

### Migration: Add character_id to ProductAdJob

```python
# src/database/migrations/versions/028_add_character_id_to_product_ad_jobs.py
def upgrade():
    op.add_column("product_ad_jobs", sa.Column("character_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_product_ad_jobs_character_id",
        "product_ad_jobs", "characters",
        ["character_id"], ["id"],
    )
    op.create_index("idx_product_ad_jobs_character_id", "product_ad_jobs", ["character_id"])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No character filtering (all content visible) | Character selector in sidebar (Phase 13) | Phase 13 (v2.0) | Selector exists but does not filter content pages |
| `character_id` as integer Query param | `character_slug` as string Query param | Phase 1000 | Frontend uses slugs, backend resolves to ID |

## Endpoint Audit

### Endpoints Already Supporting Character Filtering

| Endpoint | Route File | Param | Filter Column |
|----------|-----------|-------|---------------|
| `GET /content` | content.py | `character_id` (int) | `ContentPackage.character_id` |
| `GET /themes` | themes.py | `character_id` (int) | `Theme.character_id` |
| `POST /themes` | themes.py | `character_id` (int) | `Theme.character_id` |
| `DELETE /themes/{key}` | themes.py | `character_id` (int) | `Theme.character_id` |
| `GET /publishing/queue` | publishing.py | `character_id` (int) | `ScheduledPost.character_id` |
| `GET /pipeline/runs` | pipeline.py | `character_id` (int) | `PipelineRun.character_id` |

**Note:** These use `character_id` (integer), not `character_slug`. The frontend currently never passes this param because pages don't consume `CharacterContext`. Need to either (a) switch these to accept `character_slug`, or (b) add Character.id to the CharacterSummary type and pass the ID. Option (a) is more consistent with the target pattern.

### Endpoints Needing character_slug Added

| Endpoint | Route File | Filter Column Exists? | Work Required |
|----------|-----------|----------------------|---------------|
| `GET /generate/video/list` | video.py | Yes (`ContentPackage.character_id`) | Add `character_slug` Query param + WHERE clause |
| `GET /reels/jobs` | reels.py | Yes (`ReelsJob.character_id`) | Add `character_slug` Query param + WHERE clause |
| `GET /ads/jobs` | ads.py | **NO** (`ProductAdJob` lacks `character_id`) | Migration + add param + WHERE clause |
| `GET /drive/images` | drive.py | No (filesystem-based) | Complex -- consider ContentPackage query or directory filtering |
| `GET /dashboard/usage-history` | dashboard.py | Indirectly (via Character join) | Add `character_slug` filter to existing join |
| `GET /dashboard/cost-breakdown` | dashboard.py | Indirectly | Add `character_slug` filter |
| `GET /dashboard/pipeline-activity` | dashboard.py | Yes (via `PipelineRun.character_id`) | Add `character_slug` filter |
| `GET /dashboard/publishing-stats` | dashboard.py | Yes (via `ScheduledPost.character_id`) | Add `character_slug` filter |
| `GET /publishing/queue/summary` | publishing.py | No character filter | Add `character_slug` to summary query |

### Frontend Pages Needing CharacterContext Wiring

| Page | Hook(s) Used | Currently Character-Scoped? |
|------|-------------|---------------------------|
| Gallery (`/gallery`) | `useDriveImages`, `useDriveThemes`, `useContentPackages` | No |
| Videos (`/videos`) | `useVideoGallery` | No |
| Reels (`/reels`) | `useReelJobs` (listing only -- creation already passes slug) | No (listing), Partial (creation) |
| Ads (`/ads`) | `useAdJobs` | No |
| Themes (`/themes`) | `useThemes` | No |
| Publishing (`/publishing`) | `usePublishingQueue`, `useQueueSummary`, `usePublishingCalendar` | No |
| Dashboard (`/dashboard`) | Multiple dashboard hooks | No |
| Pipeline (`/pipeline`) | `usePipelineRuns`, `useContentPackages` | Partial (manual run passes slug) |

## Open Questions

1. **"All Characters" option**
   - What we know: CharacterContext defaults to "mago-mestre". There's no "all" option in the selector.
   - What's unclear: Does the user want an "all characters" view, or always force single-character scope?
   - Recommendation: Add an "All Characters" option as the default when the user has 2+ characters. Pass `undefined` for character_slug when "all" is selected (backend returns unfiltered data as today).

2. **Drive Images (Gallery) filtering approach**
   - What we know: Drive images are filesystem-based. No `character_id` in the file listing. However, `assets/backgrounds/{character_slug}/` directories exist per character.
   - What's unclear: Should gallery show only images from the selected character's background directory? Or should it show ContentPackage-linked images?
   - Recommendation: For `assets/backgrounds/` images, filter by directory. For `output/backgrounds_generated/` images, filter via ContentPackage join (images are linked to content packages which have `character_id`).

3. **Dashboard character scoping priority**
   - What we know: Dashboard queries are complex aggregations. Adding character filtering is possible but adds complexity.
   - What's unclear: Is dashboard character scoping required for MVP?
   - Recommendation: Defer dashboard character scoping to a follow-up. The high-value items are gallery, videos, reels, ads, themes, and publishing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python backend) |
| Config file | `pyproject.toml` (pytest section) |
| Quick run command | `python -m pytest tests/ -x -q` |
| Full suite command | `python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAR-01 | CharacterSelector in sidebar persists between pages | manual-only | N/A (UI component, already exists) | N/A |
| CHAR-02 | React Context provides activeSlug to all pages | manual-only | N/A (frontend integration) | N/A |
| CHAR-03 | Gallery filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_drive_images_character -x` | Wave 0 |
| CHAR-04 | Videos filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_video_list_character -x` | Wave 0 |
| CHAR-05 | Reels filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_reel_jobs_character -x` | Wave 0 |
| CHAR-06 | Ads filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_ad_jobs_character -x` | Wave 0 |
| CHAR-07 | Themes filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_themes_character -x` | Wave 0 |
| CHAR-08 | Publishing filtered by character_slug | integration | `python -m pytest tests/test_character_filter.py::test_publishing_character -x` | Wave 0 |
| CHAR-09 | Backend endpoints accept ?character_slug= | unit | `python -m pytest tests/test_character_filter.py -x` | Wave 0 |
| CHAR-10 | localStorage persistence of selected character | manual-only | N/A (already implemented in CharacterContext) | N/A |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_character_filter.py -x -q`
- **Per wave merge:** `python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_character_filter.py` -- covers CHAR-03 through CHAR-09 (backend endpoint filtering)
- [ ] Migration 028 for `ProductAdJob.character_id` -- required before ads filtering works

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `memelab/src/contexts/character-context.tsx` -- existing CharacterContext with full state management
- Codebase analysis: `memelab/src/components/layout/sidebar.tsx` -- existing CharacterSelector with dropdown UI
- Codebase analysis: `src/database/models.py` -- all models have `character_id` except ProductAdJob
- Codebase analysis: `src/api/deps.py` -- `get_user_character(slug, user, session)` helper exists
- Codebase analysis: `src/api/routes/content.py`, `themes.py`, `publishing.py` -- already accept `character_id` param

### Secondary (MEDIUM confidence)
- SWR documentation: Cache key change triggers automatic refetch (well-established SWR pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps, all existing
- Architecture: HIGH -- pattern exists in codebase, just needs propagation
- Pitfalls: HIGH -- identified from direct code analysis
- Endpoint audit: HIGH -- every route file inspected line by line

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- internal architecture, no external dep changes)
