from fastapi import FastAPI

from app.config import settings
from app.players.router import router as players_router

app = FastAPI(title="WorldDraft")
app.include_router(players_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
