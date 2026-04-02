"""Centralized credit service for Kie.ai API call gating.

Handles balance check, deduction, refund, top-up, and audit logging.
All operations create a CreditLog entry for traceability.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import compute_credit_cost
from src.database.models import CreditLog, UserCredit


class InsufficientCreditsError(Exception):
    """Raised when user balance is below required credits."""

    def __init__(self, balance: int, required: int):
        self.balance = balance
        self.required = required
        super().__init__(f"Insufficient credits: have {balance}, need {required}")


class CreditService:
    """Atomic credit operations: check, deduct, refund, top-up."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_and_deduct(
        self,
        user_id: int,
        model_id: str,
        duration: int,
        job_type: str,
        job_id: str,
    ) -> int:
        """Pre-check balance, deduct credits, log the call.

        Returns credits consumed. Raises InsufficientCreditsError if blocked.
        Uses SELECT ... FOR UPDATE for row locking on MySQL;
        SQLite falls back to implicit single-writer serialization.
        """
        cost = self.compute_credit_cost(model_id, duration)
        credit = await self._get_or_create_balance(user_id)

        if credit.balance < cost:
            await self._log(
                user_id=user_id,
                log_type="blocked",
                model=model_id,
                duration=duration,
                credits=cost,
                balance_after=credit.balance,
                status="blocked",
                job_type=job_type,
                job_id=job_id,
            )
            raise InsufficientCreditsError(balance=credit.balance, required=cost)

        credit.balance -= cost
        await self._log(
            user_id=user_id,
            log_type="deduction",
            model=model_id,
            duration=duration,
            credits=cost,
            balance_after=credit.balance,
            status="success",
            job_type=job_type,
            job_id=job_id,
        )
        await self.session.flush()
        return cost

    async def refund(
        self,
        user_id: int,
        credits: int,
        reason: str,
        job_type: str,
        job_id: str,
    ) -> int:
        """Refund credits on failed generation. Returns new balance."""
        credit = await self._get_or_create_balance(user_id)
        credit.balance += credits
        await self._log(
            user_id=user_id,
            log_type="refund",
            model=None,
            duration=None,
            credits=credits,
            balance_after=credit.balance,
            status="refunded",
            job_type=job_type,
            job_id=job_id,
            note=reason,
        )
        await self.session.flush()
        return credit.balance

    async def top_up(
        self,
        user_id: int,
        amount: int,
        admin_id: int,
        note: str,
    ) -> int:
        """Admin manual credit addition with audit trail. Returns new balance."""
        credit = await self._get_or_create_balance(user_id)
        credit.balance += amount
        await self._log(
            user_id=user_id,
            log_type="top_up",
            model=None,
            duration=None,
            credits=amount,
            balance_after=credit.balance,
            status="success",
            job_type=None,
            job_id=None,
            note=note or f"Admin top-up by user {admin_id}",
        )
        await self.session.flush()
        return credit.balance

    async def get_balance(self, user_id: int) -> int:
        """Return current credit balance for user (0 if no record)."""
        credit = await self._get_or_create_balance(user_id)
        return credit.balance

    async def _get_or_create_balance(self, user_id: int) -> UserCredit:
        """Get existing UserCredit or create with balance=0."""
        stmt = select(UserCredit).where(UserCredit.user_id == user_id)
        # Use FOR UPDATE on MySQL to prevent race conditions
        try:
            stmt = stmt.with_for_update()
        except Exception:
            pass  # SQLite doesn't support FOR UPDATE
        result = await self.session.execute(stmt)
        credit = result.scalar_one_or_none()
        if credit is None:
            credit = UserCredit(user_id=user_id, balance=0)
            self.session.add(credit)
            await self.session.flush()
        return credit

    async def _log(
        self,
        user_id: int,
        log_type: str,
        model: str | None,
        duration: int | None,
        credits: int,
        balance_after: int,
        status: str,
        job_type: str | None,
        job_id: str | None,
        note: str | None = None,
    ) -> None:
        """Create a CreditLog entry."""
        entry = CreditLog(
            user_id=user_id,
            type=log_type,
            model=model,
            duration=duration,
            credits=credits,
            balance_after=balance_after,
            status=status,
            job_type=job_type,
            job_id=job_id,
            note=note,
        )
        self.session.add(entry)
        await self.session.flush()

    @staticmethod
    def compute_credit_cost(model_id: str, duration: int) -> int:
        """Delegate to config.compute_credit_cost."""
        return compute_credit_cost(model_id, duration)
