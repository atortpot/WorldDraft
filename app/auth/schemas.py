from datetime import datetime

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    # La fuerza de la password (longitud + mayuscula + minuscula + caracter
    # especial) se valida en el servicio (validate_password), no aqui: asi
    # las 4 reglas se devuelven siempre como un unico 400 con mensaje claro,
    # en vez de mezclar un 422 de Pydantic para la longitud con un 400 para
    # el resto.
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
