from fastapi import FastAPI

from app.config import settings
from app.model.router import router as model_router
from app.players.router import router as players_router

app = FastAPI(title="WorldDraft")
app.include_router(players_router)
app.include_router(model_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
