from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.game.draft_service import DraftError
from app.game.router import router as game_router
from app.model.router import router as model_router
from app.players.router import router as players_router

app = FastAPI(title="WorldDraft")
app.include_router(players_router)
app.include_router(model_router)
app.include_router(game_router)


@app.exception_handler(DraftError)
async def draft_error_handler(request: Request, exc: DraftError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
def health_check():
    return {"status": "ok"}
