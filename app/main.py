from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db.init_db import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="WorldDraft", lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}
