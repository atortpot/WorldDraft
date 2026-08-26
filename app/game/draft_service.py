"""Logica del draft: elegir jugadores por posicion, validar la formacion,
calcular las metricas agregadas del equipo y simular el partido final contra
un rival historico real.
"""

import random
from collections import Counter
from pathlib import Path
from statistics import mean

import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DraftPick, DraftRound, DraftSession, DraftStatus, Formation, Player
from app.game.formations import is_slot_compatible, slots_for
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

# Toda formacion tiene exactamente 11 slots (ver app/game/formations.py).
TEAM_SIZE = 11
MAX_PASSES = 3

# Torneo de 7 partidos: 3 de grupos (fase en la que un empate no elimina) +
# 4 eliminatorias directas. GROUP_1/2/3 comparten fase (misma fuerza de
# rival, mismo round_encoded) y solo se distinguen para llevar la cuenta de
# en que partido de grupos va la sesion.
ROUND_ORDER = [
    DraftRound.GROUP_1,
    DraftRound.GROUP_2,
    DraftRound.GROUP_3,
    DraftRound.ROUND_OF_16,
    DraftRound.QUARTER_FINAL,
    DraftRound.SEMI_FINAL,
    DraftRound.FINAL,
]
KNOCKOUT_ROUNDS = {
    DraftRound.ROUND_OF_16,
    DraftRound.QUARTER_FINAL,
    DraftRound.SEMI_FINAL,
    DraftRound.FINAL,
}

# Debe coincidir con ROUND_ENCODING de scripts/train_model.py (con el que se
# entreno el modelo): groups=1, octavos=2, cuartos=3, semis=4, final=5.
ROUND_TO_MODEL_ENCODING = {
    DraftRound.GROUP_1: 1,
    DraftRound.GROUP_2: 1,
    DraftRound.GROUP_3: 1,
    DraftRound.ROUND_OF_16: 2,
    DraftRound.QUARTER_FINAL: 3,
    DraftRound.SEMI_FINAL: 4,
    DraftRound.FINAL: 5,
}

# Percentil (sobre todos los (equipo, torneo) de WorldCupMatches.csv
# ordenados por puntos FIFA) del que se sortea el rival de cada ronda: en
# grupos, nivel medio; en eliminatorias, cada vez mas alto.
ROUND_STRENGTH_BANDS: dict[DraftRound, tuple[float, float]] = {
    DraftRound.GROUP_1: (0.35, 0.65),
    DraftRound.GROUP_2: (0.35, 0.65),
    DraftRound.GROUP_3: (0.35, 0.65),
    DraftRound.ROUND_OF_16: (0.55, 0.75),
    DraftRound.QUARTER_FINAL: (0.70, 0.85),
    DraftRound.SEMI_FINAL: (0.82, 0.93),
    DraftRound.FINAL: (0.90, 1.0),
}


class DraftError(Exception):
    """Error de validacion del draft (formacion invalida, jugador repetido, etc.)."""


async def start_draft(user_id: int, formation: Formation, db: AsyncSession) -> int:
    draft_session = DraftSession(
        user_id=user_id,
        status=DraftStatus.IN_PROGRESS,
        current_round=DraftRound.GROUP_1,
        formation=formation,
    )
    db.add(draft_session)
    await db.commit()
    await db.refresh(draft_session)
    return draft_session.id


async def _get_session_or_raise(
    draft_session_id: int, db: AsyncSession, user_id: int | None = None
) -> DraftSession:
    draft_session = await db.get(DraftSession, draft_session_id)
    if draft_session is None:
        raise DraftError(f"El draft {draft_session_id} no existe")
    if user_id is not None and draft_session.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Este draft no pertenece al usuario autenticado"
        )
    return draft_session


async def _existing_picks(draft_session_id: int, db: AsyncSession) -> list[DraftPick]:
    result = await db.execute(select(DraftPick).where(DraftPick.draft_session_id == draft_session_id))
    return list(result.scalars().all())


async def _free_slots(draft_session: DraftSession, db: AsyncSession) -> list[dict]:
    """Slots de la formacion de la sesion (indice + tipo de posicion) que
    todavia no tienen jugador, en el orden de la formacion."""
    filled_indices = {pick.slot_index for pick in await _existing_picks(draft_session.id, db)}
    return [
        {"slot_index": index, "position": position}
        for index, position in enumerate(slots_for(draft_session.formation))
        if index not in filled_indices
    ]


async def _available_players(
    draft_session_id: int, country: str, year: int, db: AsyncSession
) -> list[Player]:
    already_picked = select(DraftPick.player_id).where(DraftPick.draft_session_id == draft_session_id)
    stmt = (
        select(Player)
        .where(
            Player.country == country,
            Player.tournament_year == year,
            Player.id.notin_(already_picked),
        )
        .order_by(Player.position, Player.rating.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _draw_country_year(draft_session_id: int, db: AsyncSession) -> tuple[str, int]:
    """Sortea una (seleccion, año) que todavia tenga al menos un jugador sin
    elegir en esta sesion, entre todas las combinaciones de la tabla players."""
    already_picked = select(DraftPick.player_id).where(DraftPick.draft_session_id == draft_session_id)
    stmt = (
        select(Player.country, Player.tournament_year)
        .where(Player.id.notin_(already_picked))
        .distinct()
    )
    combos = (await db.execute(stmt)).all()
    if not combos:
        raise DraftError("No quedan jugadores disponibles para sortear")
    country, year = random.choice(combos)
    return country, year


async def roll_draft(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    """Devuelve la tirada activa de la sesion, sorteando una nueva si no
    habia ninguna pendiente. Idempotente mientras no se resuelva con un pick
    o un pass: llamar varias veces devuelve siempre la misma tirada."""
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    if draft_session.status != DraftStatus.IN_PROGRESS:
        raise DraftError("Este draft ya ha finalizado")

    if draft_session.current_roll_country is None:
        country, year = await _draw_country_year(draft_session_id, db)
        draft_session.current_roll_country = country
        draft_session.current_roll_year = year
        await db.commit()
    else:
        country, year = draft_session.current_roll_country, draft_session.current_roll_year

    return {
        "country": country,
        "tournament_year": year,
        "players": await _available_players(draft_session_id, country, year, db),
        "free_slots": await _free_slots(draft_session, db),
        "passes_used": draft_session.passes_used,
        "passes_remaining": MAX_PASSES - draft_session.passes_used,
    }


async def pass_roll(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    if draft_session.status != DraftStatus.IN_PROGRESS:
        raise DraftError("Este draft ya ha finalizado")
    if draft_session.current_roll_country is None:
        raise DraftError("No hay ninguna tirada activa que pasar: llama a /roll primero")
    if draft_session.passes_used >= MAX_PASSES:
        raise DraftError(f"Ya has usado los {MAX_PASSES} pases disponibles")

    draft_session.passes_used += 1
    draft_session.current_roll_country = None
    draft_session.current_roll_year = None
    await db.commit()

    return {
        "passes_used": draft_session.passes_used,
        "passes_remaining": MAX_PASSES - draft_session.passes_used,
    }


async def pick_player(
    draft_session_id: int,
    player_id: int,
    slot_index: int,
    user_id: int,
    db: AsyncSession,
) -> dict:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    if draft_session.status != DraftStatus.IN_PROGRESS:
        raise DraftError("Este draft ya ha finalizado")
    if draft_session.current_roll_country is None:
        raise DraftError("No hay ninguna tirada activa: llama a /roll primero")

    slots = slots_for(draft_session.formation)
    if slot_index < 0 or slot_index >= len(slots):
        raise DraftError(f"El slot {slot_index} no existe en la formacion {draft_session.formation.value}")
    slot_position = slots[slot_index]

    player = await db.get(Player, player_id)
    if player is None:
        raise DraftError(f"El jugador {player_id} no existe")
    if (
        player.country != draft_session.current_roll_country
        or player.tournament_year != draft_session.current_roll_year
    ):
        raise DraftError(
            f"{player.name} no pertenece a la tirada actual "
            f"({draft_session.current_roll_country} {draft_session.current_roll_year})"
        )
    if not is_slot_compatible(slot_position, player.position):
        raise DraftError(
            f"{player.name} juega de {player.position.value} y no puede ocupar un slot {slot_position}"
        )

    existing_picks = await _existing_picks(draft_session_id, db)

    if any(pick.player_id == player_id for pick in existing_picks):
        raise DraftError(f"{player.name} ya fue elegido en este draft")
    if any(pick.slot_index == slot_index for pick in existing_picks):
        raise DraftError(f"El slot {slot_position} (#{slot_index}) ya esta ocupado")

    draft_pick = DraftPick(draft_session_id=draft_session_id, player_id=player_id, slot_index=slot_index)
    db.add(draft_pick)

    draft_session.current_roll_country = None
    draft_session.current_roll_year = None

    if len(existing_picks) + 1 == TEAM_SIZE:
        draft_session.status = DraftStatus.FINISHED

    await db.commit()
    await db.refresh(draft_pick)
    return {"pick_id": draft_pick.id, "player_id": draft_pick.player_id, "slot_index": slot_index, "slot_position": slot_position}


async def get_draft_team(draft_session_id: int, user_id: int, db: AsyncSession) -> list[dict]:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    slots = slots_for(draft_session.formation)
    stmt = (
        select(DraftPick, Player)
        .join(Player, DraftPick.player_id == Player.id)
        .where(DraftPick.draft_session_id == draft_session_id)
        .order_by(DraftPick.slot_index)
    )
    result = await db.execute(stmt)
    return [
        {
            "pick_id": pick.id,
            "slot_index": pick.slot_index,
            "slot_position": slots[pick.slot_index],
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


async def get_active_draft_session(user_id: int, db: AsyncSession) -> dict | None:
    """La sesion mas reciente del usuario que todavia no ha terminado, para
    poder recuperarla tras recargar la pagina.

    "Activa" se define por current_round, no por status: status pasa a
    FINISHED en cuanto se completan los 11 picks, pero la sesion sigue en
    curso mientras dura el torneo (current_round avanza hasta eliminated o
    champion). Si hay varias sesiones activas (p.ej. el usuario abandono un
    draft a medias y empezo otro), se devuelve la mas reciente.
    """
    stmt = (
        select(DraftSession)
        .where(
            DraftSession.user_id == user_id,
            DraftSession.current_round.notin_([DraftRound.ELIMINATED, DraftRound.CHAMPION]),
        )
        .order_by(DraftSession.created_at.desc(), DraftSession.id.desc())
        .limit(1)
    )
    draft_session = (await db.execute(stmt)).scalars().first()
    if draft_session is None:
        return None

    return {
        "draft_session_id": draft_session.id,
        "current_round": draft_session.current_round.value,
        "formation": draft_session.formation.value,
        "picks": await get_draft_team(draft_session.id, user_id, db),
        "free_slots": await _free_slots(draft_session, db),
    }


def _goals_per_match(goals: int, minutes_played: int) -> float:
    if minutes_played <= 0:
        return 0.0
    games_played = max(round(minutes_played / 90), 1)
    return goals / games_played


# Umbral minimo de jugadores de una misma seleccion -> bonus sobre el rating
# medio del equipo. Se evalua de mayor a menor umbral y se aplica solo el
# primero que se cumple (no son acumulables entre si).
NATION_CHEMISTRY_TIERS: list[tuple[int, float]] = [(7, 0.15), (5, 0.10), (3, 0.05)]

# Decadas de juego (no las decadas de calendario reales: agrupacion propia
# del juego, tal como se definio el sistema de quimica).
DECADE_BY_YEAR: dict[int, str] = {
    1994: "1990s",
    1998: "1990s",
    2002: "2000s",
    2006: "2000s",
    2010: "2000s",
    2014: "2010s",
    2018: "2010s",
    2022: "2020s",
    2026: "2020s",
}
ERA_CHEMISTRY_THRESHOLD = 4
ERA_CHEMISTRY_BONUS = 0.05


def _calculate_chemistry(team: list[dict]) -> dict:
    """Bonus de rating por quimica de seleccion + quimica de epoca,
    acumulables entre si (no dentro de cada una: solo cuenta el tramo mas
    alto que se alcanza)."""
    nation_counts = Counter(member["country"] for member in team)
    nation_country, nation_count = nation_counts.most_common(1)[0]

    nation_bonus = 0.0
    nation_detail = None
    for threshold, bonus in NATION_CHEMISTRY_TIERS:
        if nation_count >= threshold:
            nation_bonus = bonus
            nation_detail = {"country": nation_country, "count": nation_count, "bonus": bonus}
            break

    era_counts = Counter(
        DECADE_BY_YEAR[member["tournament_year"]]
        for member in team
        if member["tournament_year"] in DECADE_BY_YEAR
    )
    era_bonus = 0.0
    era_detail = None
    if era_counts:
        era_name, era_count = era_counts.most_common(1)[0]
        if era_count >= ERA_CHEMISTRY_THRESHOLD:
            era_bonus = ERA_CHEMISTRY_BONUS
            era_detail = {"era": era_name, "count": era_count, "bonus": era_bonus}

    return {
        "nation_bonus": nation_bonus,
        "era_bonus": era_bonus,
        "total_bonus": round(nation_bonus + era_bonus, 2),
        "chemistry_details": {"nation": nation_detail, "era": era_detail},
    }


async def calculate_team_stats(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    team = await get_draft_team(draft_session_id, user_id, db)
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

    chemistry = _calculate_chemistry(team)
    base_rating_avg = mean(ratings) if ratings else 0.0

    return {
        "fifa_points_avg": mean(fifa_points) if fifa_points else 0.0,
        "rating_avg": base_rating_avg * (1 + chemistry["total_bonus"]),
        "goals_avg": mean(goals_per_match) if goals_per_match else 0.0,
        "chemistry": chemistry,
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


_team_appearances_with_points: pd.DataFrame | None = None


def _load_team_appearances_with_points() -> pd.DataFrame:
    """Un (equipo, torneo) por fila con sus puntos FIFA, ordenados de menor a
    mayor, para poder sortear rivales dentro de una franja de fuerza."""
    team_years = _get_team_appearances()[["team", "Year"]].drop_duplicates().reset_index(drop=True)
    team_years["fifa_points"] = [
        fifa_points_at(row.team, tournament_start_date(int(row.Year))) or 0.0
        for row in team_years.itertuples()
    ]
    return team_years.sort_values("fifa_points").reset_index(drop=True)


def _get_team_appearances_with_points() -> pd.DataFrame:
    global _team_appearances_with_points
    if _team_appearances_with_points is None:
        _team_appearances_with_points = _load_team_appearances_with_points()
    return _team_appearances_with_points


def _select_opponent_team_year(round_: DraftRound) -> tuple[str, int]:
    ranked = _get_team_appearances_with_points()
    lo_pct, hi_pct = ROUND_STRENGTH_BANDS[round_]
    total = len(ranked)
    lo_idx = int(total * lo_pct)
    hi_idx = max(int(total * hi_pct), lo_idx + 1)
    band = ranked.iloc[lo_idx:hi_idx]
    chosen = band.sample(1).iloc[0]
    return chosen["team"], int(chosen["Year"])


async def get_opponent_for_round(round_: DraftRound, db: AsyncSession) -> dict:
    team, year = _select_opponent_team_year(round_)
    appearances = _get_team_appearances()

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


async def simulate_draft_match(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    if draft_session.current_round in (DraftRound.ELIMINATED, DraftRound.CHAMPION):
        raise DraftError("El torneo ya ha terminado para este draft")

    team = await get_draft_team(draft_session_id, user_id, db)
    if len(team) != TEAM_SIZE:
        raise DraftError(f"El equipo debe tener {TEAM_SIZE} jugadores para simular (tiene {len(team)})")

    current_round = draft_session.current_round
    team_stats = await calculate_team_stats(draft_session_id, user_id, db)
    opponent = await get_opponent_for_round(current_round, db)

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
    round_encoded = ROUND_TO_MODEL_ENCODING[current_round]
    chemistry_bonus = team_stats["chemistry"]["total_bonus"]

    outcome = simulate_match(
        team_a_stats, team_b_stats, round_encoded=round_encoded, chemistry_bonus=chemistry_bonus
    )
    explanation = explain_match(
        team_a_stats, team_b_stats, round_encoded=round_encoded, chemistry_bonus=chemistry_bonus
    )

    is_knockout = current_round in KNOCKOUT_ROUNDS
    penalties = None
    advanced: bool

    if outcome["result"] == "win":
        advanced = True
    elif outcome["result"] == "loss":
        advanced = False
    else:
        # Empate: en grupos cuenta como avance; en eliminatorias se resuelve
        # a penaltis, sin ventaja para ningun lado (50/50).
        if is_knockout:
            won_penalties = random.random() < 0.5
            penalties = {"took_place": True, "won_by_team": won_penalties}
            advanced = won_penalties
        else:
            advanced = True

    if not advanced:
        draft_session.current_round = DraftRound.ELIMINATED
    elif current_round == DraftRound.FINAL:
        draft_session.current_round = DraftRound.CHAMPION
    else:
        draft_session.current_round = ROUND_ORDER[ROUND_ORDER.index(current_round) + 1]

    await db.commit()

    tournament_finished = draft_session.current_round in (DraftRound.ELIMINATED, DraftRound.CHAMPION)

    return {
        "opponent": {"country": opponent["country"], "tournament_year": opponent["tournament_year"]},
        "team_stats": team_a_stats,
        "opponent_stats": team_b_stats,
        "win": outcome["win"],
        "draw": outcome["draw"],
        "loss": outcome["loss"],
        "result": outcome["result"],
        "penalties": penalties,
        "advanced": advanced,
        "round": current_round.value,
        "next_round": draft_session.current_round.value,
        "tournament_finished": tournament_finished,
        "explanation": explanation,
        "chemistry": team_stats["chemistry"],
    }
