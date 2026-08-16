from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import PlayerPosition
from app.game import draft_service

router = APIRouter(prefix="/game/draft", tags=["draft"])

POSITION_ABBREVIATIONS = {
    "GK": PlayerPosition.GOALKEEPER,
    "DF": PlayerPosition.DEFENDER,
    "MF": PlayerPosition.MIDFIELDER,
    "FW": PlayerPosition.FORWARD,
}
POSITION_TO_ABBREVIATION = {v: k for k, v in POSITION_ABBREVIATIONS.items()}


def _parse_position(value: str) -> PlayerPosition:
    try:
        return POSITION_ABBREVIATIONS[value.upper()]
    except KeyError:
        raise HTTPException(status_code=422, detail=f"Posicion invalida: {value!r}. Usa GK, DF, MF o FW.")


class StartDraftRequest(BaseModel):
    user_id: int


class StartDraftResponse(BaseModel):
    draft_session_id: int


class PickRequest(BaseModel):
    player_id: int
    position_slot: str


@router.post("/start", response_model=StartDraftResponse)
async def start_draft_endpoint(payload: StartDraftRequest, db: AsyncSession = Depends(get_db)):
    session_id = await draft_service.start_draft(payload.user_id, db)
    return StartDraftResponse(draft_session_id=session_id)


@router.get("/{session_id}/candidates")
async def get_candidates_endpoint(
    session_id: int,
    position: str = Query(..., description="GK, DF, MF o FW"),
    year_from: int = 1994,
    year_to: int = 2026,
    db: AsyncSession = Depends(get_db),
):
    parsed_position = _parse_position(position)
    candidates = await draft_service.get_draft_candidates(
        session_id, parsed_position, year_from, year_to, db
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "country": p.country,
            "tournament_year": p.tournament_year,
            "position": POSITION_TO_ABBREVIATION[p.position],
            "goals": p.goals,
            "assists": p.assists,
            "minutes_played": p.minutes_played,
            "rating": p.rating,
        }
        for p in candidates
    ]


@router.post("/{session_id}/pick")
async def pick_endpoint(session_id: int, payload: PickRequest, db: AsyncSession = Depends(get_db)):
    position_slot = _parse_position(payload.position_slot)
    pick = await draft_service.pick_player(session_id, payload.player_id, position_slot, db)
    return {
        "pick_id": pick.id,
        "player_id": pick.player_id,
        "position_slot": POSITION_TO_ABBREVIATION[pick.position_slot],
    }


@router.get("/{session_id}/team")
async def get_team_endpoint(session_id: int, db: AsyncSession = Depends(get_db)):
    return await draft_service.get_draft_team(session_id, db)


@router.post("/{session_id}/simulate")
async def simulate_endpoint(session_id: int, db: AsyncSession = Depends(get_db)):
    return await draft_service.simulate_draft_match(session_id, db)
