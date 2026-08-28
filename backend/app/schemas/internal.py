from pydantic import BaseModel


class CleanupResponse(BaseModel):
    deleted_sessions: int
