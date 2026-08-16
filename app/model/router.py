from fastapi import APIRouter
from pydantic import BaseModel

from app.model.simulator import DEFAULT_ROUND_ENCODED, simulate_match

router = APIRouter(prefix="/model", tags=["model"])


class TeamStats(BaseModel):
    fifa_points: float
    player_rating_avg: float
    goals_avg: float


class SimulateMatchRequest(BaseModel):
    team_a: TeamStats
    team_b: TeamStats
    round_encoded: int = DEFAULT_ROUND_ENCODED


class SimulateMatchResponse(BaseModel):
    win: float
    draw: float
    loss: float
    result: str


@router.post("/simulate", response_model=SimulateMatchResponse)
def simulate_match_endpoint(payload: SimulateMatchRequest) -> SimulateMatchResponse:
    outcome = simulate_match(
        payload.team_a.model_dump(),
        payload.team_b.model_dump(),
        round_encoded=payload.round_encoded,
    )
    return SimulateMatchResponse(**outcome)
