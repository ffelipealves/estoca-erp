from fastapi import Request, status
from fastapi.responses import JSONResponse


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "domain_error"
    default_detail = "Não foi possível concluir a operação"

    def __init__(
        self,
        detail: str | None = None,
        *,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.detail = detail or self.default_detail
        self.headers = headers
        super().__init__(self.detail)


class AuthenticationError(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "authentication_error"
    default_detail = "Credenciais inválidas"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(
            detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthorizationError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "authorization_error"
    default_detail = "Você não tem permissão para realizar esta operação"


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    default_detail = "Recurso não encontrado"


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    default_detail = "O recurso conflita com um registro existente"


class BusinessRuleError(DomainError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "business_rule_error"
    default_detail = "A operação viola uma regra de negócio"


class LimitExceededError(BusinessRuleError):
    code = "limit_exceeded"
    default_detail = "O limite permitido foi atingido"


async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    content = {
        "detail": exc.detail,
        "code": exc.code,
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=exc.headers,
    )
