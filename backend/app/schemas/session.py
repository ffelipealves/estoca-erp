from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SessionBootstrapResponse(BaseModel):
    session_id: UUID
    expires_at: datetime


class SessionInfoResponse(SessionBootstrapResponse):
    created_at: datetime
    last_activity_at: datetime
    ttl_seconds: int
    # Com estes dois o cliente renova a contagem a cada resposta da API, sem
    # repetir a configuração: expira em min(atividade + janela, limite).
    inactivity_seconds: int
    max_expires_at: datetime


class SessionResetResponse(BaseModel):
    session_id: UUID
    categories_seeded: int
    products_seeded: int
