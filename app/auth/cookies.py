"""Cookie de sesion httpOnly, como segundo transporte de autenticacion junto
al Bearer token (que se mantiene para Swagger / clientes de API)."""

from fastapi import Response

from app.auth.security import ACCESS_TOKEN_EXPIRE_MINUTES
from app.config import settings

COOKIE_NAME = "worlddraftauth"
_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _cookie_flags() -> dict:
    """En produccion (Railway) el frontend y el backend viven en dominios
    distintos, asi que la cookie tiene que ser cross-site: eso exige
    SameSite=None, y los navegadores rechazan SameSite=None sin Secure (la
    peticion tiene que ir por HTTPS). En desarrollo local se sirve por HTTP
    y frontend/backend son same-site via el proxy de Vite, asi que
    SameSite=Lax + Secure=False es lo correcto ahi -- Secure=True rompería
    la cookie en local porque el navegador nunca la mandaria por HTTP."""
    if settings.is_production:
        return {"secure": True, "samesite": "none"}
    return {"secure": False, "samesite": "lax"}


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        path="/",
        **_cookie_flags(),
    )


def clear_auth_cookie(response: Response) -> None:
    # secure/samesite deben coincidir con los de set_auth_cookie: un
    # navegador solo borra la cookie si el Set-Cookie de borrado matchea
    # sus atributos (aparte de key/path).
    response.delete_cookie(key=COOKIE_NAME, path="/", **_cookie_flags())
