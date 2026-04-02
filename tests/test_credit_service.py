"""Tests for credit system: models, config, and CreditService (CRED-01 through CRED-06)."""
import pytest
import pytest_asyncio
from sqlalchemy import Integer, String, Text, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


# ============================================================
# Task 1 Tests: Models + Config
# ============================================================


def test_user_credit_model_fields():
    """UserCredit has user_id (unique FK), balance (Integer, server_default 0)."""
    from src.database.models import UserCredit
    table = UserCredit.__table__
    cols = {c.name: c for c in table.columns}

    assert "user_id" in cols
    assert "balance" in cols

    # user_id is unique FK to users.id
    uid_col = cols["user_id"]
    assert uid_col.unique is True
    fks = list(uid_col.foreign_keys)
    assert len(fks) == 1
    assert "users.id" in str(fks[0].target_fullname)

    # balance is Integer with server_default 0
    bal_col = cols["balance"]
    assert isinstance(bal_col.type, Integer)
    assert bal_col.server_default is not None


def test_user_credit_uses_timestamp_mixin():
    """UserCredit has created_at and updated_at from TimestampMixin."""
    from src.database.models import UserCredit
    table = UserCredit.__table__
    cols = {c.name for c in table.columns}
    assert "created_at" in cols
    assert "updated_at" in cols


def test_credit_log_model_fields():
    """CreditLog has all required fields with correct types."""
    from src.database.models import CreditLog
    table = CreditLog.__table__
    cols = {c.name: c for c in table.columns}

    assert "user_id" in cols
    assert "type" in cols
    assert "model" in cols
    assert "duration" in cols
    assert "credits" in cols
    assert "balance_after" in cols
    assert "status" in cols
    assert "job_type" in cols
    assert "job_id" in cols
    assert "note" in cols

    # type is String(20)
    assert isinstance(cols["type"].type, String)
    assert cols["type"].type.length == 20

    # model is String(100), nullable
    assert isinstance(cols["model"].type, String)
    assert cols["model"].type.length == 100
    assert cols["model"].nullable is True

    # duration is Integer, nullable
    assert isinstance(cols["duration"].type, Integer)
    assert cols["duration"].nullable is True

    # job_type is String(20), nullable
    assert isinstance(cols["job_type"].type, String)
    assert cols["job_type"].nullable is True

    # job_id is String(36), nullable
    assert isinstance(cols["job_id"].type, String)
    assert cols["job_id"].type.length == 36
    assert cols["job_id"].nullable is True

    # note is Text, nullable
    assert isinstance(cols["note"].type, Text)
    assert cols["note"].nullable is True


def test_credit_log_uses_timestamp_mixin():
    """CreditLog has created_at and updated_at from TimestampMixin."""
    from src.database.models import CreditLog
    table = CreditLog.__table__
    cols = {c.name for c in table.columns}
    assert "created_at" in cols
    assert "updated_at" in cols


def test_credit_costs_dict_has_all_models():
    """CREDIT_COSTS dict has entries for all models in VIDEO_MODELS plus suno/v4."""
    from config import CREDIT_COSTS, VIDEO_MODELS
    for model_id in VIDEO_MODELS:
        assert model_id in CREDIT_COSTS, f"Missing CREDIT_COSTS entry for {model_id}"
    assert "suno/v4" in CREDIT_COSTS


def test_compute_credit_cost_known_model():
    """compute_credit_cost returns correct value for known model+duration."""
    from config import compute_credit_cost
    assert compute_credit_cost("hailuo/2-3-image-to-video-standard", 6) == 21
    assert compute_credit_cost("hailuo/2-3-image-to-video-standard", 10) == 21
    assert compute_credit_cost("bytedance/v1-pro-fast-image-to-video", 5) == 52
    assert compute_credit_cost("bytedance/v1-pro-fast-image-to-video", 10) == 104


def test_compute_credit_cost_snaps_to_closest_duration():
    """compute_credit_cost snaps to closest duration for unknown durations."""
    from config import compute_credit_cost
    # Hailuo has {6: 21, 10: 21} -- duration=7 closer to 6
    assert compute_credit_cost("hailuo/2-3-image-to-video-standard", 7) == 21
    # bytedance/v1-pro has {5: 52, 10: 104} -- duration=8 closer to 10
    assert compute_credit_cost("bytedance/v1-pro-fast-image-to-video", 8) == 104


def test_compute_credit_cost_suno():
    """Suno music costs 14 credits (duration=0 key)."""
    from config import compute_credit_cost
    assert compute_credit_cost("suno/v4", 0) == 14


def test_user_model_has_credits_relationship():
    """User model has credits relationship to UserCredit."""
    from src.database.models import User
    assert hasattr(User, "credits"), "User missing 'credits' relationship"


# ============================================================
# Task 2 Tests: CreditService (async, in-memory SQLite)
# ============================================================


@pytest_asyncio.fixture
async def async_session():
    """Create in-memory SQLite session with all tables."""
    from src.database.base import Base
    import src.database.models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def user_with_credits(async_session):
    """Create a User with 100 credits."""
    from src.database.models import User, UserCredit

    user = User(
        email="test@example.com",
        hashed_password="hashed",
        role="user",
    )
    async_session.add(user)
    await async_session.flush()

    credit = UserCredit(user_id=user.id, balance=100)
    async_session.add(credit)
    await async_session.flush()

    return user


async def test_check_and_deduct_sufficient_balance(async_session, user_with_credits):
    """CRED-02: Deduction with sufficient balance deducts and returns credits consumed."""
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

    balance = await svc.get_balance(user_with_credits.id)
    assert balance == 79  # 100 - 21


async def test_check_and_deduct_insufficient_balance(async_session, user_with_credits):
    """CRED-01: Insufficient balance raises InsufficientCreditsError and logs blocked."""
    from src.services.credit_service import CreditService, InsufficientCreditsError
    from src.database.models import CreditLog
    from sqlalchemy import select

    svc = CreditService(async_session)

    # Set balance to 10 (less than 21 for hailuo)
    credit = await svc._get_or_create_balance(user_with_credits.id)
    credit.balance = 10
    await async_session.flush()

    with pytest.raises(InsufficientCreditsError) as exc_info:
        await svc.check_and_deduct(
            user_id=user_with_credits.id,
            model_id="hailuo/2-3-image-to-video-standard",
            duration=6,
            job_type="video",
            job_id="test-job-2",
        )
    assert exc_info.value.balance == 10
    assert exc_info.value.required == 21

    # Verify blocked call was logged
    result = await async_session.execute(
        select(CreditLog).where(
            CreditLog.user_id == user_with_credits.id,
            CreditLog.type == "blocked",
        )
    )
    log = result.scalar_one()
    assert log.status == "blocked"
    assert log.balance_after == 10  # unchanged


async def test_refund_adds_credits_back(async_session, user_with_credits):
    """CRED-03: Refund adds credits back and logs type=refund."""
    from src.services.credit_service import CreditService
    from src.database.models import CreditLog
    from sqlalchemy import select

    svc = CreditService(async_session)

    # First deduct
    await svc.check_and_deduct(
        user_id=user_with_credits.id,
        model_id="hailuo/2-3-image-to-video-standard",
        duration=6,
        job_type="video",
        job_id="test-job-3",
    )
    assert await svc.get_balance(user_with_credits.id) == 79

    # Now refund
    new_balance = await svc.refund(
        user_id=user_with_credits.id,
        credits=21,
        reason="generation_failed",
        job_type="video",
        job_id="test-job-3",
    )
    assert new_balance == 100

    # Verify refund log
    result = await async_session.execute(
        select(CreditLog).where(
            CreditLog.user_id == user_with_credits.id,
            CreditLog.type == "refund",
        )
    )
    log = result.scalar_one()
    assert log.status == "refunded"
    assert log.credits == 21
    assert log.balance_after == 100


async def test_top_up_adds_credits(async_session, user_with_credits):
    """CRED-04: Top-up adds credits and logs type=top_up with admin note."""
    from src.services.credit_service import CreditService
    from src.database.models import CreditLog
    from sqlalchemy import select

    svc = CreditService(async_session)

    new_balance = await svc.top_up(
        user_id=user_with_credits.id,
        amount=500,
        admin_id=99,
        note="Welcome bonus",
    )
    assert new_balance == 600  # 100 + 500

    # Verify top_up log
    result = await async_session.execute(
        select(CreditLog).where(
            CreditLog.user_id == user_with_credits.id,
            CreditLog.type == "top_up",
        )
    )
    log = result.scalar_one()
    assert log.credits == 500
    assert log.balance_after == 600
    assert log.note == "Welcome bonus"


async def test_get_or_create_balance_new_user(async_session):
    """get_or_create_balance creates UserCredit with balance=0 for new users."""
    from src.services.credit_service import CreditService
    from src.database.models import User

    user = User(email="new@example.com", hashed_password="hashed", role="user")
    async_session.add(user)
    await async_session.flush()

    svc = CreditService(async_session)
    credit = await svc._get_or_create_balance(user.id)
    assert credit.balance == 0
    assert credit.user_id == user.id


async def test_blocked_call_logged_with_correct_balance(async_session, user_with_credits):
    """CRED-06: Blocked calls are logged with balance_after reflecting current balance."""
    from src.services.credit_service import CreditService, InsufficientCreditsError
    from src.database.models import CreditLog
    from sqlalchemy import select

    svc = CreditService(async_session)

    # Set balance to 5
    credit = await svc._get_or_create_balance(user_with_credits.id)
    credit.balance = 5
    await async_session.flush()

    with pytest.raises(InsufficientCreditsError):
        await svc.check_and_deduct(
            user_id=user_with_credits.id,
            model_id="kling-3.0/video",
            duration=10,
            job_type="reel",
            job_id="test-job-4",
        )

    result = await async_session.execute(
        select(CreditLog).where(
            CreditLog.user_id == user_with_credits.id,
            CreditLog.type == "blocked",
        )
    )
    log = result.scalar_one()
    assert log.balance_after == 5
    assert log.credits == 174  # kling-3.0 10s cost
    assert log.model == "kling-3.0/video"
    assert log.job_type == "reel"


async def test_compute_credit_cost_delegates_to_config():
    """CreditService.compute_credit_cost delegates to config.compute_credit_cost."""
    from src.services.credit_service import CreditService
    assert CreditService.compute_credit_cost("hailuo/2-3-image-to-video-standard", 6) == 21
    assert CreditService.compute_credit_cost("suno/v4", 0) == 14
