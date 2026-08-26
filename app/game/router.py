from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import Formation, PlayerPosition, User
from app.game import draft_service

router = APIRouter(prefix="/game/draft", tags=["draft"])

POSITION_TO_ABBREVIATION = {
    PlayerPosition.GOALKEEPER: "GK",
    PlayerPosition.DEFENDER: "DF",
    PlayerPosition.MIDFIELDER: "MF",
    PlayerPosition.FORWARD: "FW",
}


class StartDraftRequest(BaseModel):
    formation: Formation


class StartDraftResponse(BaseModel):
    draft_session_id: int


class PickRequest(BaseModel):
    player_id: int
    slot_index: int


@router.post("/start", response_model=StartDraftResponse)
async def start_draft_endpoint(
    payload: StartDraftRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_id = await draft_service.start_draft(current_user.id, payload.formation, db)
    return StartDraftResponse(draft_session_id=session_id)


@router.get("/active")
async def get_active_draft_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await draft_service.get_active_draft_session(current_user.id, db)


@router.get("/{session_id}/roll")
async def roll_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await draft_service.roll_draft(session_id, current_user.id, db)
    return {
        "country": result["country"],
        "tournament_year": result["tournament_year"],
        "players": [
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
            for p in result["players"]
        ],
        "free_slots": result["free_slots"],
        "passes_used": result["passes_used"],
        "passes_remaining": result["passes_remaining"],
        "max_passes": draft_service.MAX_PASSES,
    }


@router.post("/{session_id}/pass")
async def pass_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await draft_service.pass_roll(session_id, current_user.id, db)
    return {**result, "max_passes": draft_service.MAX_PASSES}


@router.post("/{session_id}/pick")
async def pick_endpoint(
    session_id: int,
    payload: PickRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await draft_service.pick_player(
        session_id, payload.player_id, payload.slot_index, current_user.id, db
    )


@router.get("/{session_id}/team")
async def get_team_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await draft_service.get_draft_team(session_id, current_user.id, db)


@router.post("/{session_id}/simulate")
async def simulate_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await draft_service.simulate_draft_match(session_id, current_user.id, db)
