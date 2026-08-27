import json

from app.core.errors import BusinessRuleError, domain_error_handler


async def test_domain_error_handler() -> None:
    response = await domain_error_handler(
        None,
        BusinessRuleError("Saldo insuficiente"),
    )

    assert response.status_code == 422
    assert json.loads(response.body) == {
        "detail": "Saldo insuficiente",
        "code": "business_rule_error",
    }
