"""Cookie de sesion httpOnly, como segundo transporte de autenticacion junto
al Bearer token (que se mantiene para Swagger / clientes de API)."""

import os

from fastapi import Response

from app.auth.security import ACCESS_TOKEN_EXPIRE_MINUTES

COOKIE_NAME = "worlddraftauth"
_COOKIE_MAX_AGE_SECONDS = ACCESS_TOKEN_EXPIRE_MINUTES * 60

# Se lee os.environ directamente en vez de settings.is_production (que en
# los hechos hace exactamente lo mismo: settings.environment tambien sale
# de la variable de entorno ENVIRONMENT, via pydantic-settings) -- es una
# capa de indireccion menos para descartar dudas, y deja el valor crudo
# disponible para el print de abajo, que es lo que de verdad diagnostica
# el problema: si esto imprime algo distinto de "production" en los logs
# de arranque de Railway, la cookie NUNCA va a llevar secure=True/
# samesite=none por mucho que este codigo este bien, porque la variable
# ENVIRONMENT no esta llegando como se espera (p.ej. no esta puesta en
# Railway, o se confundio con la RAILWAY_ENVIRONMENT que Railway inyecta
# solo, que es una variable distinta).
_ENVIRONMENT = os.environ.get("ENVIRONMENT", "")
print(f"[worlddraft] ENVIRONMENT leido al arrancar: {_ENVIRONMENT!r}", flush=True)


def _cookie_flags() -> dict:
    """En produccion (Railway) el frontend y el backend viven en dominios
    distintos, asi que la cookie tiene que ser cross-site: eso exige
    SameSite=None, y los navegadores rechazan SameSite=None sin Secure (la
    peticion tiene que ir por HTTPS). En desarrollo local se sirve por HTTP
    y frontend/backend son same-site via el proxy de Vite, asi que
    SameSite=Lax + Secure=False es lo correcto ahi -- Secure=True rompería
    la cookie en local porque el navegador nunca la mandaria por HTTP.

    OJO: aunque esto este bien configurado, SameSite=None con dos dominios
    de terceros de verdad distintos (worlddraft.up.railway.app y
    worlddraft-production.up.railway.app NO comparten eTLD+1: cada
    "*.up.railway.app" es un sufijo publico independiente para efectos de
    cookies, igual que *.github.io o *.vercel.app) puede seguir sin
    funcionar en navegadores que bloquean cookies de terceros por defecto
    (Safari ITP, o Chrome cuando termine de retirarlas). Si el print de
    arriba confirma "production" y la cookie sigue sin llegar, el
    problema ya no es este codigo -- hace falta que frontend y backend
    compartan el mismo sitio (dominio propio con la API en un subdominio,
    o un proxy inverso que sirva la API desde el mismo origen que el
    frontend), SameSite=None+Secure no es una solucion garantizada a
    largo plazo entre dos dominios de terceros distintos."""
    if _ENVIRONMENT == "production":
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
