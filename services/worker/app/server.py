from __future__ import annotations

from .data_lifecycle import router as data_lifecycle_router
from .main import app
from .observability import install_observability, router as observability_router
from .retrieval_api import router as retrieval_router
from .semantic_index import install_semantic_indexer

app.include_router(retrieval_router)
app.include_router(observability_router)
app.include_router(data_lifecycle_router)
install_observability(app)
install_semantic_indexer(app)

__all__ = ["app"]
