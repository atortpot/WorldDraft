from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth.router import router as auth_router
from app.config import settings
from app.game.draft_service import DraftError
from app.game.router import router as game_router
from app.model.router import router as model_router
from app.players.router import router as players_router

app = FastAPI(title="WorldDraft")

# Solo hace falta cuando frontend y backend viven en dominios distintos
# (Railway): en desarrollo el proxy de Vite hace que las peticiones sean
# same-origin, asi que CORS_ORIGINS vacio (el default) deja esta lista
# vacia y el middleware no añade cabeceras para nadie -- mismo
# comportamiento que no tenerlo. allow_credentials=True es obligatorio
# para que el navegador mande la cookie de sesion en peticiones cross-site
# (ver app/auth/cookies.py); con eso, allow_origins no puede ser "*", tiene
# que ser la lista explicita de origenes de settings.cors_origins_list.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(players_router)
app.include_router(model_router)
app.include_router(game_router)


@app.exception_handler(DraftError)
async def draft_error_handler(request: Request, exc: DraftError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
def health_check():
    return {"status": "ok"}
