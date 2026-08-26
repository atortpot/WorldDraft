"""Cookie de sesion httpOnly, como segundo transporte de autenticacion junto
al Bearer token (que se mantiene para Swagger / clientes de API)."""

from fastapi import Response

from app.auth.security import ACCESS_TOKEN_EXPIRE_MINUTES

COOKIE_NAME = "worlddraftauth"
_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRE_MINUTES * 60


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        # secure=False porque en desarrollo local se sirve por HTTP. En
        # cualquier despliegue real detras de HTTPS esto debe pasar a True.
        secure=False,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")
