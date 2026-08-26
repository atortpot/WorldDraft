"""Hashing de contraseñas (bcrypt), validacion de fuerza de password y
firma/verificacion de JWT."""

import re
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

PASSWORD_MIN_LENGTH = 8
_SPECIAL_CHAR_RE = re.compile(r"[^A-Za-z0-9]")


def validate_password(password: str) -> list[str]:
    """Reglas de fuerza de la contraseña. Debe coincidir exactamente con
    passwordSchema en frontend/src/lib/validation.ts (mismas 4 reglas, mismo
    orden) para que ambas capas se comporten igual.

    Devuelve la lista de reglas incumplidas; vacia si la password es valida.
    """
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Debe tener al menos {PASSWORD_MIN_LENGTH} caracteres")
    if not any(c.isupper() for c in password):
        errors.append("Debe incluir al menos una mayuscula")
    if not any(c.islower() for c in password):
        errors.append("Debe incluir al menos una minuscula")
    if not _SPECIAL_CHAR_RE.search(password):
        errors.append("Debe incluir al menos un caracter especial")
    return errors


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Devuelve el user_id del token, o None si es invalido/ha caducado."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None

    subject = payload.get("sub")
    if subject is None:
        return None
    try:
        return int(subject)
    except ValueError:
        return None
