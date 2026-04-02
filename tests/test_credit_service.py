"""Tests for credit system: models, config, and CreditService (CRED-01 through CRED-06)."""
import pytest
from sqlalchemy import Integer, String, Text, ForeignKey


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
