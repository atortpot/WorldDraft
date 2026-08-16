from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.players.importer import import_players

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/import")
async def import_players_endpoint(session: AsyncSession = Depends(get_db)) -> dict:
    return await import_players(session)
