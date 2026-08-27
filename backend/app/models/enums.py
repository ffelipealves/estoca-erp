from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    operador = "operador"


class StockMovementType(str, Enum):
    entrada = "entrada"
    saida = "saida"
    ajuste = "ajuste"
