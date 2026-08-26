from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cookies import COOKIE_NAME
from app.auth.security import decode_access_token
from app.db.database import get_db
from app.db.models import User

# auto_error=False para poder devolver nuestro propio mensaje/formato de 401
# en vez del generico "Not authenticated" de HTTPBearer.
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dos formas de autenticarse, en este orden: el header
    "Authorization: Bearer <token>" (usado por Swagger y clientes de API), y
    si no viene, la cookie httpOnly de sesion (usada por el frontend)."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials if credentials is not None else request.cookies.get(COOKIE_NAME)
    if token is None:
        raise unauthorized

    user_id = decode_access_token(token)
    if user_id is None:
        raise unauthorized

    user = await db.get(User, user_id)
    if user is None:
        raise unauthorized

    return user
