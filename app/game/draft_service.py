"""Logica del draft: elegir jugadores por posicion, validar la formacion,
calcular las metricas agregadas del equipo y simular el partido final contra
un rival historico real.
"""

from pathlib import Path
from statistics import mean

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DraftPick, DraftSession, DraftStatus, Player, PlayerPosition
from app.model.fifa_data import (
    clean_worldcup_matches_team_name,
    fifa_points_at,
    to_fifa_ranking_country,
    to_squads_country_name,
    tournament_start_date,
)
from app.model.simulator import explain_match, simulate_match

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
WORLDCUP_MATCHES_CSV = DATA_DIR / "WorldCupMatches.csv"
MIN_YEAR = 1994

# Formacion fija: 1 portero, 4 defensas, 4 mediocampistas, 2 delanteros.
FORMATION = {
    PlayerPosition.GOALKEEPER: 1,
    PlayerPosition.DEFENDER: 4,
    PlayerPosition.MIDFIELDER: 4,
    PlayerPosition.FORWARD: 2,
}
TEAM_SIZE = sum(FORMATION.values())


class DraftError(Exception):
    """Error de validacion del draft (formacion invalida, jugador repetido, etc.)."""


async def start_draft(user_id: int, db: AsyncSession) -> int:
    draft_session = DraftSession(user_id=user_id, status=DraftStatus.IN_PROGRESS)
    db.add(draft_session)
    await db.commit()
    await db.refresh(draft_session)
    return draft_session.id


async def _get_session_or_raise(draft_session_id: int, db: AsyncSession) -> DraftSession:
    draft_session = await db.get(DraftSession, draft_session_id)
    if draft_session is None:
        raise DraftError(f"El draft {draft_session_id} no existe")
    return draft_session


async def get_draft_candidates(
    draft_session_id: int,
    position: PlayerPosition,
    year_from: int,
    year_to: int,
    db: AsyncSession,
) -> list[Player]:
    await _get_session_or_raise(draft_session_id, db)
    already_picked = select(DraftPick.player_id).where(DraftPick.draft_session_id == draft_session_id)

    stmt = (
        select(Player)
        .where(
            Player.position == position,
            Player.tournament_year.between(year_from, year_to),
            Player.id.notin_(already_picked),
        )
        .order_by(func.random())
        .limit(4)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def pick_player(
    draft_session_id: int,
    player_id: int,
    position_slot: PlayerPosition,
    db: AsyncSession,
) -> DraftPick:
    draft_session = await _get_session_or_raise(draft_session_id, db)
    if draft_session.status != DraftStatus.IN_PROGRESS:
        raise DraftError("Este draft ya ha finalizado")

    player = await db.get(Player, player_id)
    if player is None:
        raise DraftError(f"El jugador {player_id} no existe")
    if player.position != position_slot:
        raise DraftError(
            f"{player.name} juega de {player.position.value}, no se puede alinear en {position_slot.value}"
        )

    existing_picks = (
        (await db.execute(select(DraftPick).where(DraftPick.draft_session_id == draft_session_id)))
        .scalars()
        .all()
    )

    if any(pick.player_id == player_id for pick in existing_picks):
        raise DraftError(f"{player.name} ya fue elegido en este draft")

    slot_count = sum(1 for pick in existing_picks if pick.position_slot == position_slot)
    if slot_count >= FORMATION[position_slot]:
        raise DraftError(f"Ya se cubrieron los {FORMATION[position_slot]} puestos de {position_slot.value}")

    draft_pick = DraftPick(draft_session_id=draft_session_id, player_id=player_id, position_slot=position_slot)
    db.add(draft_pick)

    if len(existing_picks) + 1 == TEAM_SIZE:
        draft_session.status = DraftStatus.FINISHED

    await db.commit()
    await db.refresh(draft_pick)
    return draft_pick


async def get_draft_team(draft_session_id: int, db: AsyncSession) -> list[dict]:
    await _get_session_or_raise(draft_session_id, db)
    stmt = (
        select(DraftPick, Player)
        .join(Player, DraftPick.player_id == Player.id)
        .where(DraftPick.draft_session_id == draft_session_id)
        .order_by(DraftPick.id)
    )
    result = await db.execute(stmt)
    return [
        {
            "pick_id": pick.id,
            "position_slot": pick.position_slot.value,
            "player_id": player.id,
            "name": player.name,
            "country": player.country,
            "tournament_year": player.tournament_year,
            "position": player.position.value,
            "goals": player.goals,
            "assists": player.assists,
            "minutes_played": player.minutes_played,
            "rating": player.rating,
        }
        for pick, player in result.all()
    ]


def _goals_per_match(goals: int, minutes_played: int) -> float:
    if minutes_played <= 0:
        return 0.0
    games_played = max(round(minutes_played / 90), 1)
    return goals / games_played


async def calculate_team_stats(draft_session_id: int, db: AsyncSession) -> dict:
    team = await get_draft_team(draft_session_id, db)
    if not team:
        raise DraftError("El draft todavia no tiene jugadores elegidos")

    fifa_points, ratings, goals_per_match = [], [], []

    for member in team:
        ratings.append(member["rating"])
        goals_per_match.append(_goals_per_match(member["goals"], member["minutes_played"]))

        canonical_country = to_fifa_ranking_country(member["country"])
        start_date = tournament_start_date(member["tournament_year"])
        points = fifa_points_at(canonical_country, start_date)
        if points is not None:
            fifa_points.append(points)

    return {
        "fifa_points_avg": mean(fifa_points) if fifa_points else 0.0,
        "rating_avg": mean(ratings) if ratings else 0.0,
        "goals_avg": mean(goals_per_match) if goals_per_match else 0.0,
    }


_team_appearances: pd.DataFrame | None = None


def _load_team_appearances() -> pd.DataFrame:
    """Una fila por (equipo, torneo, partido): goles marcados en ese partido.

    Solo cubre Mundiales 1994-2014 porque WorldCupMatches.csv no llega mas
    alla; los rivales historicos del draft salen de ese rango.
    """
    df = pd.read_csv(WORLDCUP_MATCHES_CSV)
    df = df.dropna(subset=["Year", "MatchID"]).drop_duplicates(subset=["MatchID"])
    df["Year"] = df["Year"].astype(int)
    df = df[df["Year"] >= MIN_YEAR]

    home = df[["Year", "Home Team Name", "Home Team Goals"]].rename(
        columns={"Home Team Name": "team", "Home Team Goals": "goals_scored"}
    )
    away = df[["Year", "Away Team Name", "Away Team Goals"]].rename(
        columns={"Away Team Name": "team", "Away Team Goals": "goals_scored"}
    )
    appearances = pd.concat([home, away], ignore_index=True)
    appearances["team"] = appearances["team"].apply(clean_worldcup_matches_team_name)
    return appearances


def _get_team_appearances() -> pd.DataFrame:
    global _team_appearances
    if _team_appearances is None:
        _team_appearances = _load_team_appearances()
    return _team_appearances


async def get_random_historical_opponent(db: AsyncSession) -> dict:
    appearances = _get_team_appearances()
    team_years = appearances[["team", "Year"]].drop_duplicates()
    chosen = team_years.sample(1).iloc[0]
    team, year = chosen["team"], int(chosen["Year"])

    team_matches = appearances[(appearances["team"] == team) & (appearances["Year"] == year)]
    goals_avg = float(team_matches["goals_scored"].mean())

    fifa_points = fifa_points_at(team, tournament_start_date(year)) or 0.0

    wiki_country = to_squads_country_name(team)
    ratings = (
        (
            await db.execute(
                select(Player.rating).where(
                    Player.country == wiki_country, Player.tournament_year == year
                )
            )
        )
        .scalars()
        .all()
    )
    rating_avg = float(mean(ratings)) if ratings else 0.0

    return {
        "country": wiki_country,
        "tournament_year": year,
        "fifa_points": fifa_points,
        "player_rating_avg": rating_avg,
        "goals_avg": goals_avg,
    }


async def simulate_draft_match(draft_session_id: int, db: AsyncSession) -> dict:
    team = await get_draft_team(draft_session_id, db)
    if len(team) != TEAM_SIZE:
        raise DraftError(f"El equipo debe tener {TEAM_SIZE} jugadores para simular (tiene {len(team)})")

    team_stats = await calculate_team_stats(draft_session_id, db)
    opponent = await get_random_historical_opponent(db)

    team_a_stats = {
        "fifa_points": team_stats["fifa_points_avg"],
        "player_rating_avg": team_stats["rating_avg"],
        "goals_avg": team_stats["goals_avg"],
    }
    team_b_stats = {
        "fifa_points": opponent["fifa_points"],
        "player_rating_avg": opponent["player_rating_avg"],
        "goals_avg": opponent["goals_avg"],
    }

    outcome = simulate_match(team_a_stats, team_b_stats)
    explanation = explain_match(team_a_stats, team_b_stats)

    return {
        "opponent": {"country": opponent["country"], "tournament_year": opponent["tournament_year"]},
        "team_stats": team_a_stats,
        "opponent_stats": team_b_stats,
        "win": outcome["win"],
        "draw": outcome["draw"],
        "loss": outcome["loss"],
        "result": outcome["result"],
        "explanation": explanation,
    }
