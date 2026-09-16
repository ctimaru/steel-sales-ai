from __future__ import annotations

from .bulk_import_api import router as bulk_import_router
from .data_lifecycle import router as data_lifecycle_router
from .data_source_center import router as data_source_center_router
from .global_search import router as global_search_router
from .main import app
from .observability import install_observability, router as observability_router
from .retrieval_api import router as retrieval_router
from .semantic_index import install_semantic_indexer
from .tenant_admin import router as tenant_admin_router

app.include_router(retrieval_router)
app.include_router(global_search_router)
app.include_router(observability_router)
app.include_router(data_lifecycle_router)
app.include_router(tenant_admin_router)
app.include_router(bulk_import_router)
app.include_router(data_source_center_router)
install_observability(app)
install_semantic_indexer(app)

__all__ = ["app"]
