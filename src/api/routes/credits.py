"""Credit system API routes — balance, logs, admin top-up.

Provides 3 endpoints:
  - GET /credits/balance     — current user's credit balance
  - GET /credits/logs        — paginated credit log with filters
  - POST /credits/admin/top-up — admin-only credit addition
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import db_session, get_current_user
from src.database.models import CreditLog
from src.services.credit_service import CreditService

router = APIRouter(prefix="/credits", tags=["Credits"])


# ── Balance ──────────────────────────────────────────────────────────────────

@router.get("/balance", summary="Saldo de creditos do usuario")
async def get_balance(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
):
    credit_svc = CreditService(session)
    balance = await credit_svc.get_balance(current_user.id)
    return {
        "user_id": current_user.id,
        "balance": balance,
        "equivalent_usd": round(balance * 0.007, 2),
    }


# ── Logs ─────────────────────────────────────────────────────────────────────

@router.get("/logs", summary="Historico de creditos com filtros")
async def get_logs(
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    model: str | None = Query(None),
    log_type: str | None = Query(None),
):
    """Paginated credit logs filtered by date range, model, and type."""
    base = select(CreditLog).where(CreditLog.user_id == current_user.id)

    if date_from:
        base = base.where(CreditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        base = base.where(CreditLog.created_at <= datetime.fromisoformat(date_to))
    if model:
        base = base.where(CreditLog.model == model)
    if log_type:
        base = base.where(CreditLog.type == log_type)

    # Total count
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Paginated results
    offset = (page - 1) * per_page
    stmt = base.order_by(CreditLog.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(stmt)
    rows = result.scalars().all()

    logs = [
        {
            "id": row.id,
            "type": row.type,
            "model": row.model,
            "duration": row.duration,
            "credits": row.credits,
            "balance_after": row.balance_after,
            "status": row.status,
            "job_type": row.job_type,
            "job_id": row.job_id,
            "note": row.note,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]

    return {"total": total, "page": page, "per_page": per_page, "logs": logs}


# ── Admin Top-Up ─────────────────────────────────────────────────────────────

class TopUpRequest(BaseModel):
    user_id: int
    amount: int = Field(..., gt=0)
    note: str = ""


@router.post("/admin/top-up", summary="Admin: adicionar creditos a usuario")
async def admin_top_up(
    req: TopUpRequest,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(db_session),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    credit_svc = CreditService(session)
    new_balance = await credit_svc.top_up(req.user_id, req.amount, current_user.id, req.note)
    await session.commit()
    return {"user_id": req.user_id, "credits_added": req.amount, "new_balance": new_balance}
