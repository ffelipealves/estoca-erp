from fastapi import FastAPI

from app.core.config import settings
from app.core.errors import DomainError, domain_error_handler

app = FastAPI(title=settings.app_name)
app.add_exception_handler(DomainError, domain_error_handler)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
