from __future__ import annotations

from .bulk_import_api import router as bulk_import_router
from .data_lifecycle import router as data_lifecycle_router
from .data_source_center import router as data_source_center_router
from .evidence import router as evidence_router
from .global_search import router as global_search_router
from .main import app
from .observability import install_observability, router as observability_router
from .offer_reparse import install_offer_reparse_bootstrap, router as offer_reparse_router
from .source_reingest import router as source_reingest_router
from .p1_assistant import router as p1_assistant_router
from .product_360 import router as product_360_router
from .promotion_readiness import router as promotion_readiness_router
from .message_identity_reconstruction import router as message_identity_reconstruction_router
from .retrieval_api import router as retrieval_router
from .semantic_index import install_semantic_indexer
from .tenant_admin import router as tenant_admin_router

app.include_router(retrieval_router)
app.include_router(global_search_router)
app.include_router(p1_assistant_router)
app.include_router(product_360_router)
app.include_router(promotion_readiness_router)
app.include_router(message_identity_reconstruction_router)
app.include_router(observability_router)
app.include_router(data_lifecycle_router)
app.include_router(tenant_admin_router)
app.include_router(bulk_import_router)
app.include_router(data_source_center_router)
app.include_router(evidence_router)
app.include_router(offer_reparse_router)
app.include_router(source_reingest_router)
install_offer_reparse_bootstrap(app)
install_observability(app)
install_semantic_indexer(app)

__all__ = ["app"]
