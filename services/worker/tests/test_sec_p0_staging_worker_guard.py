import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location("guard", Path(__file__).resolve().parents[2] / "scripts/sec-p0-staging-worker-guard.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

BASE = dict(
    REQUESTED_PROJECT_REF="lwrrrphakpbjhbzljqhn",
    RAILWAY_ENVIRONMENT_NAME="staging",
    RAILWAY_STAGING_PROJECT_ID="staging-project",
    RAILWAY_STAGING_SERVICE_ID="staging-service",
    RAILWAY_STAGING_ENVIRONMENT_ID="staging-env",
    STAGING_WORKER_URL="https://staging-worker.example.invalid",
    STAGING_WORKER_INTERNAL_TOKEN="dummy-test-token",
)

def test_valid_staging_config():
    module.verify_staging_worker_env(BASE)

@pytest.mark.parametrize("override", [
    {"RAILWAY_ENVIRONMENT_NAME": "production"},
    {"RAILWAY_STAGING_ENVIRONMENT_ID": "8dbd43c9-36a3-419f-b965-178d55567d02", "RAILWAY_STAGING_PROJECT_ID": "46de9589-577c-4e28-9d84-b2ff2d827426"},
    {"STAGING_WORKER_URL": "https://steel-sales-ai-production.up.railway.app"},
    {"STAGING_WORKER_URL": "http://staging-worker.example.invalid"},
    {"REQUESTED_PROJECT_REF": "ecrafjdummcdfycznitx"},
    {"STAGING_WORKER_INTERNAL_TOKEN": ""},
])
def test_rejects_unsafe_target(override):
    with pytest.raises(ValueError):
        module.verify_staging_worker_env({**BASE, **override})
