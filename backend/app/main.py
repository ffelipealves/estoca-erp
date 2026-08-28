from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import DomainError, domain_error_handler
from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.internal import router as internal_router
from app.routers.products import router as products_router
from app.routers.sessions import router as sessions_router
from app.routers.stock_movements import router as stock_movements_router

app = FastAPI(title=settings.app_name)
app.add_exception_handler(DomainError, domain_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(stock_movements_router, prefix="/api/v1")
app.include_router(internal_router, include_in_schema=False)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
