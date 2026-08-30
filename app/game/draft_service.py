"""Logica del draft: elegir jugadores por posicion, validar la formacion,
calcular las metricas agregadas del equipo y simular el partido final contra
un rival historico real.
"""

import functools
import random
from collections import Counter
from pathlib import Path
from statistics import mean

import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    DraftPick,
    DraftRound,
    DraftSession,
    DraftStatus,
    Formation,
    GroupStageOpponent,
    GroupStageRivalMatch,
    Player,
)
from app.game.formations import is_slot_compatible, slots_for
from app.game.narrative import generate_match_events, pick_scoreline
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

# Torneo de 7 partidos: 3 de grupos (fase de liguilla, ver mas abajo) + 4
# eliminatorias directas. GROUP_1/2/3 comparten fase (mismo round_encoded)
# y solo se distinguen para llevar la cuenta de en que partido de grupos va
# la sesion.
ROUND_ORDER = [
    DraftRound.GROUP_1,
    DraftRound.GROUP_2,
    DraftRound.GROUP_3,
    DraftRound.ROUND_OF_16,
    DraftRound.QUARTER_FINAL,
    DraftRound.SEMI_FINAL,
    DraftRound.FINAL,
]
GROUP_ROUNDS = {DraftRound.GROUP_1, DraftRound.GROUP_2, DraftRound.GROUP_3}
# En que slot de GroupStageOpponent (1/2/3, ver _generate_group_opponents)
# se juega cada partido de grupos.
GROUP_ROUND_TO_SLOT: dict[DraftRound, int] = {
    DraftRound.GROUP_1: 1,
    DraftRound.GROUP_2: 2,
    DraftRound.GROUP_3: 3,
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
# ordenados por puntos FIFA) del que se sortean los rivales de cada ronda:
# en eliminatorias, cada vez mas alto. GROUP_BAND es la franja (nivel medio)
# de la que se sortean los 3 rivales de grupos DE UNA VEZ al iniciar el
# draft (ver _generate_group_opponents) -- de ahi que sean "similares entre
# si": los 3 salen de la misma franja estrecha, no de sorteos independientes
# con umbrales distintos.
GROUP_BAND: tuple[float, float] = (0.35, 0.65)
ROUND_STRENGTH_BANDS: dict[DraftRound, tuple[float, float]] = {
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
    # El grupo completo (3 rivales) se sortea de una vez aqui, no partido a
    # partido: ver _generate_group_opponents.
    draft_session.group_opponents = await _generate_group_opponents(db)
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


async def abandon_draft(draft_session_id: int, user_id: int, db: AsyncSession) -> None:
    """Marca la sesion como terminada sin completarla: deja de aparecer como
    sesion activa en /game/draft/active (que filtra por current_round) y no
    se puede seguir jugando en ella."""
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    draft_session.status = DraftStatus.FINISHED
    draft_session.current_round = DraftRound.ELIMINATED
    await db.commit()


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


def _select_team_year_from_band(
    lo_pct: float, hi_pct: float, exclude: set[tuple[str, int]] | None = None
) -> tuple[str, int] | None:
    """(equipo, año) al azar dentro de la franja de percentil de puntos FIFA
    [lo_pct, hi_pct) de todos los (equipo, torneo) de WorldCupMatches.csv.
    `exclude` descarta pares ya elegidos (usado por _generate_group_opponents
    para que los 3 rivales de un grupo sean siempre distintos entre si).
    None si la franja, tras excluir, se queda sin candidatos."""
    ranked = _get_team_appearances_with_points()
    total = len(ranked)
    lo_idx = int(total * lo_pct)
    hi_idx = max(int(total * hi_pct), lo_idx + 1)
    band = ranked.iloc[lo_idx:hi_idx]
    if exclude:
        band = band[~band.apply(lambda row: (row["team"], int(row["Year"])) in exclude, axis=1)]
    if band.empty:
        return None
    chosen = band.sample(1).iloc[0]
    return chosen["team"], int(chosen["Year"])


def _select_opponent_team_year(round_: DraftRound) -> tuple[str, int]:
    lo_pct, hi_pct = ROUND_STRENGTH_BANDS[round_]
    chosen = _select_team_year_from_band(lo_pct, hi_pct)
    assert chosen is not None  # la franja completa (sin exclude) siempre tiene candidatos
    return chosen


def _opponent_static_stats(team: str, year: int) -> dict:
    """fifa_points y goals_avg -- estaticos, dependen solo de equipo+año, no
    hace falta acceso a la base de datos."""
    appearances = _get_team_appearances()
    team_matches = appearances[(appearances["team"] == team) & (appearances["Year"] == year)]
    goals_avg = float(team_matches["goals_scored"].mean())
    fifa_points = fifa_points_at(team, tournament_start_date(year)) or 0.0
    return {"fifa_points": fifa_points, "goals_avg": goals_avg}


async def _opponent_roster_stats(country: str, year: int, db: AsyncSession) -> tuple[float, list[dict]]:
    """(player_rating_avg, jugadores reales) de la plantilla de ese
    pais/año en la tabla players -- puede venir vacia si esa combinacion no
    esta en la tabla, en cuyo caso rating_avg es 0 y players []. Ver
    narrative.generate_match_events, que usa `players` para elegir
    goleador real en vez del generico "Jugador rival" cuando hay datos."""
    roster = (
        (await db.execute(select(Player).where(Player.country == country, Player.tournament_year == year)))
        .scalars()
        .all()
    )
    rating_avg = float(mean(p.rating for p in roster)) if roster else 0.0
    players = [{"name": p.name, "position": p.position.value, "rating": p.rating} for p in roster]
    return rating_avg, players


async def get_opponent_for_round(round_: DraftRound, db: AsyncSession) -> dict:
    team, year = _select_opponent_team_year(round_)
    static_stats = _opponent_static_stats(team, year)
    wiki_country = to_squads_country_name(team)
    rating_avg, players = await _opponent_roster_stats(wiki_country, year, db)

    return {
        "country": wiki_country,
        "tournament_year": year,
        "fifa_points": static_stats["fifa_points"],
        "player_rating_avg": rating_avg,
        "goals_avg": static_stats["goals_avg"],
        "players": players,
    }


async def _generate_group_opponents(db: AsyncSession) -> list[GroupStageOpponent]:
    """3 rivales historicos para la fase de grupos, sorteados de la misma
    franja de percentil de puntos FIFA (GROUP_BAND) -- de ahi que sean
    "similares entre si" -- y siempre distintos entre ellos. Se generan de
    una vez al iniciar el draft (start_draft) y quedan fijos durante toda
    la fase de grupos: antes cada partido de grupos sorteaba un rival nuevo
    en el momento de simularlo, sin garantia de que no se repitiera el
    mismo entre group_1/2/3 ni de que sobreviviera a una recarga de
    pagina."""
    lo_pct, hi_pct = GROUP_BAND
    chosen: list[tuple[str, int]] = []
    for _ in range(3):
        pair = _select_team_year_from_band(lo_pct, hi_pct, exclude=set(chosen))
        if pair is None:
            raise DraftError("No hay suficientes rivales historicos distintos para generar el grupo")
        chosen.append(pair)

    opponents = []
    for slot, (team, year) in enumerate(chosen, start=1):
        static_stats = _opponent_static_stats(team, year)
        opponents.append(
            GroupStageOpponent(
                slot=slot,
                country=to_squads_country_name(team),
                tournament_year=year,
                fifa_points=static_stats["fifa_points"],
                goals_avg=static_stats["goals_avg"],
            )
        )
    return opponents


async def _group_opponent_full_stats(opponent: GroupStageOpponent, db: AsyncSession) -> dict:
    """Mismo shape que get_opponent_for_round, pero para un rival de grupo
    ya fijado (fifa_points/goals_avg ya guardados; solo la plantilla real
    hace falta resolverla contra la base de datos, porque puede cambiar
    entre pases del script de ratings)."""
    rating_avg, players = await _opponent_roster_stats(opponent.country, opponent.tournament_year, db)
    return {
        "country": opponent.country,
        "tournament_year": opponent.tournament_year,
        "fifa_points": opponent.fifa_points,
        "player_rating_avg": rating_avg,
        "goals_avg": opponent.goals_avg,
        "players": players,
    }


async def _group_opponents_for_session(draft_session_id: int, db: AsyncSession) -> list[GroupStageOpponent]:
    stmt = (
        select(GroupStageOpponent)
        .where(GroupStageOpponent.draft_session_id == draft_session_id)
        .order_by(GroupStageOpponent.slot)
    )
    return list((await db.execute(stmt)).scalars().all())


async def _rival_matches_for_session(draft_session_id: int, db: AsyncSession) -> list[GroupStageRivalMatch]:
    stmt = select(GroupStageRivalMatch).where(GroupStageRivalMatch.draft_session_id == draft_session_id)
    return list((await db.execute(stmt)).scalars().all())


# Round de modelo para los partidos rival-contra-rival: son partidos de
# fase de grupos igual que los del usuario (ROUND_TO_MODEL_ENCODING ya
# mapea los 3 group_N al mismo valor, "groups"), asi que se reutiliza tal
# cual, sin necesitar una ronda de DraftSession real para ellos.
_GROUP_STAGE_MODEL_ENCODING = 1


async def _simulate_rival_match(
    opponent_a: GroupStageOpponent, opponent_b: GroupStageOpponent, db: AsyncSession
) -> GroupStageRivalMatch:
    """Simula el partido entre estos dos rivales (nunca involucra al
    usuario). Se llama una vez por cada ronda de grupos, a la vez que el
    partido del usuario: mientras el usuario juega contra el rival de esa
    ronda, los otros 2 rivales juegan entre si -- la misma jornada, dos
    partidos a la vez, como en un grupo real. Asi, cuando el usuario acaba
    los 3 suyos, ya se han simulado tambien los 3 que le faltaban al grupo.
    Reutiliza el mismo motor ML que el resto del torneo (simulate_match +
    pick_scoreline para el marcador, igual que con el usuario), con las
    stats reales de cada rival (fifa_points/player_rating_avg/goals_avg) y
    sin bonus de quimica -- ese bonus es especifico del equipo armado a
    mano por el usuario, no aplica a dos selecciones historicas
    enfrentandose."""
    stats_a = await _group_opponent_full_stats(opponent_a, db)
    stats_b = await _group_opponent_full_stats(opponent_b, db)
    team_a_stats = {
        "fifa_points": stats_a["fifa_points"],
        "player_rating_avg": stats_a["player_rating_avg"],
        "goals_avg": stats_a["goals_avg"],
    }
    team_b_stats = {
        "fifa_points": stats_b["fifa_points"],
        "player_rating_avg": stats_b["player_rating_avg"],
        "goals_avg": stats_b["goals_avg"],
    }
    outcome = simulate_match(
        team_a_stats, team_b_stats, round_encoded=_GROUP_STAGE_MODEL_ENCODING, chemistry_bonus=0.0
    )
    goals_a, goals_b = pick_scoreline(outcome["result"], outcome["win"], outcome["draw"], outcome["loss"])

    match = GroupStageRivalMatch(
        draft_session_id=opponent_a.draft_session_id,
        home_opponent_id=opponent_a.id,
        away_opponent_id=opponent_b.id,
        home_goals=goals_a,
        away_goals=goals_b,
    )
    db.add(match)
    return match


def _group_row_for_user(draft_session: DraftSession, opponents: list[GroupStageOpponent]) -> dict:
    return {
        "is_user": True,
        "slot": None,
        "country": None,
        "tournament_year": None,
        "played": sum(1 for opp in opponents if opp.played),
        "points": draft_session.group_points,
        "goals_for": draft_session.group_goals_for,
        "goals_against": draft_session.group_goals_against,
    }


def _aggregate_rival_row(opponent: GroupStageOpponent, rival_matches: list[GroupStageRivalMatch]) -> dict:
    """points/goals_for/goals_against del rival, sumando su partido contra
    el usuario (GroupStageOpponent, sin tocar) y los partidos contra los
    otros rivales que ya se hayan simulado (GroupStageRivalMatch -- puede
    ser 0, 1 o 2 en cualquier momento, ya no solo al terminar el grupo: ver
    _simulate_rival_match). vs_user_points/vs_user_played se guardan aparte,
    sin agregar: el enfrentamiento directo con el usuario (ver
    _make_group_comparator) necesita ESE partido concreto -- y saber si ya
    se jugo REALMENTE, que ya no es lo mismo que "played > 0": con el
    reparto por jornadas, un rival puede jugar su partido contra otro
    rival antes que el suyo contra el usuario (p.ej. el rival de group_2
    juega contra el de group_3 en la jornada de group_1, antes de haberse
    enfrentado el mismo al usuario)."""
    points = opponent.points
    goals_for = opponent.goals_for
    goals_against = opponent.goals_against
    played = 1 if opponent.played else 0

    for match in rival_matches:
        if match.home_opponent_id == opponent.id:
            own_goals, other_goals = match.home_goals, match.away_goals
        elif match.away_opponent_id == opponent.id:
            own_goals, other_goals = match.away_goals, match.home_goals
        else:
            continue
        played += 1
        goals_for += own_goals
        goals_against += other_goals
        if own_goals > other_goals:
            points += 3
        elif own_goals == other_goals:
            points += 1

    return {
        "is_user": False,
        "slot": opponent.slot,
        "country": opponent.country,
        "tournament_year": opponent.tournament_year,
        "played": played,
        "points": points,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "vs_user_played": opponent.played,
        "vs_user_points": opponent.points,
    }


def _rival_h2h_points(rival_matches: list[GroupStageRivalMatch], opponents: list[GroupStageOpponent]) -> dict:
    """(slot_a, slot_b) -> puntos que se llevo el equipo del slot_a en su
    partido contra el del slot_b (3/1/0), en las dos direcciones -- el
    enfrentamiento directo entre dos rivales (ver _make_group_comparator)."""
    slot_by_opponent_id = {o.id: o.slot for o in opponents}
    lookup: dict[tuple[int, int], int] = {}
    for match in rival_matches:
        slot_home = slot_by_opponent_id[match.home_opponent_id]
        slot_away = slot_by_opponent_id[match.away_opponent_id]
        if match.home_goals > match.away_goals:
            points_home, points_away = 3, 0
        elif match.home_goals == match.away_goals:
            points_home, points_away = 1, 1
        else:
            points_home, points_away = 0, 3
        lookup[(slot_home, slot_away)] = points_home
        lookup[(slot_away, slot_home)] = points_away
    return lookup


def _make_group_comparator(rival_h2h: dict[tuple[int, int], int]):
    """Orden de 1o a 4o: puntos, luego diferencia de goles, luego
    enfrentamiento directo. `rival_h2h` (ver _rival_h2h_points) es lo que
    permite que el enfrentamiento directo tambien se pueda aplicar entre
    dos rivales, no solo entre el usuario y un rival -- antes de simular
    los partidos rival-contra-rival no habia forma de saberlo."""

    def compare(a: dict, b: dict) -> int:
        if a["points"] != b["points"]:
            return b["points"] - a["points"]
        if a["goal_diff"] != b["goal_diff"]:
            return b["goal_diff"] - a["goal_diff"]

        if a["is_user"] or b["is_user"]:
            rival = b if a["is_user"] else a
            if rival["vs_user_played"]:
                if rival["vs_user_points"] == 3:  # el rival gano el enfrentamiento directo
                    return 1 if a["is_user"] else -1
                if rival["vs_user_points"] == 0:  # el usuario gano el enfrentamiento directo
                    return -1 if a["is_user"] else 1
            return 0

        points_a_vs_b = rival_h2h.get((a["slot"], b["slot"]))
        if points_a_vs_b == 3:
            return -1  # a gano el enfrentamiento directo, va antes
        if points_a_vs_b == 0:
            return 1  # b gano el enfrentamiento directo, va antes
        return 0  # empataron entre si, o todavia no han jugado: no desempata mas

    return compare


def _rank_group(
    draft_session: DraftSession,
    opponents: list[GroupStageOpponent],
    rival_matches: list[GroupStageRivalMatch],
) -> list[dict]:
    # "played" de cada fila sale directamente de cuantos partidos hay
    # registrados para ese equipo (ver _group_row_for_user/
    # _aggregate_rival_row), no de si el grupo esta completo: con el
    # reparto por jornadas (ver _simulate_rival_match) los 4 equipos van
    # sumando partidos jugados en paralelo, ronda a ronda, no todos de
    # golpe al final.
    rows = [_group_row_for_user(draft_session, opponents)]
    rows.extend(_aggregate_rival_row(opponent, rival_matches) for opponent in opponents)

    for row in rows:
        row["goal_diff"] = row["goals_for"] - row["goals_against"]

    comparator = _make_group_comparator(_rival_h2h_points(rival_matches, opponents))
    return sorted(rows, key=functools.cmp_to_key(comparator))


def _serialize_other_matches(
    rival_matches: list[GroupStageRivalMatch], opponents: list[GroupStageOpponent]
) -> list[dict]:
    by_id = {o.id: o for o in opponents}
    return [
        {
            "home": {
                "country": by_id[match.home_opponent_id].country,
                "tournament_year": by_id[match.home_opponent_id].tournament_year,
            },
            "away": {
                "country": by_id[match.away_opponent_id].country,
                "tournament_year": by_id[match.away_opponent_id].tournament_year,
            },
            "home_goals": match.home_goals,
            "away_goals": match.away_goals,
        }
        for match in rival_matches
    ]


def _serialize_group_table(
    ranked_rows: list[dict], group_complete: bool, other_matches: list[dict]
) -> dict:
    return {
        "teams": [
            {
                "is_user": row["is_user"],
                "country": row["country"],
                "tournament_year": row["tournament_year"],
                "played": row["played"],
                "points": row["points"],
                "goals_for": row["goals_for"],
                "goals_against": row["goals_against"],
                "goal_diff": row["goal_diff"],
                "qualified": (ranked_rows.index(row) < 2) if group_complete else None,
            }
            for row in ranked_rows
        ],
        "group_complete": group_complete,
        # Los partidos rival-contra-rival simulados hasta ahora (0 a 3, uno
        # por ronda de grupos jugada -- ver _simulate_rival_match), para que
        # el frontend pueda enseñar "que paso en el resto del grupo".
        "other_matches": other_matches,
    }


async def get_group_table(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    opponents = await _group_opponents_for_session(draft_session_id, db)
    rival_matches = await _rival_matches_for_session(draft_session_id, db)
    group_complete = len(opponents) == 3 and all(o.played for o in opponents)
    ranked = _rank_group(draft_session, opponents, rival_matches)
    # Los partidos rival-contra-rival simulados hasta ahora, no solo cuando
    # el grupo esta completo: se van acumulando ronda a ronda (ver
    # _simulate_rival_match), asi que la tabla "en tiempo real" tambien
    # puede enseñarlos progresivamente.
    other_matches = _serialize_other_matches(rival_matches, opponents)
    return _serialize_group_table(ranked, group_complete, other_matches)


async def simulate_draft_match(draft_session_id: int, user_id: int, db: AsyncSession) -> dict:
    draft_session = await _get_session_or_raise(draft_session_id, db, user_id)
    if draft_session.current_round in (DraftRound.ELIMINATED, DraftRound.CHAMPION):
        raise DraftError("El torneo ya ha terminado para este draft")

    team = await get_draft_team(draft_session_id, user_id, db)
    if len(team) != TEAM_SIZE:
        raise DraftError(f"El equipo debe tener {TEAM_SIZE} jugadores para simular (tiene {len(team)})")

    current_round = draft_session.current_round
    is_group = current_round in GROUP_ROUNDS
    team_stats = await calculate_team_stats(draft_session_id, user_id, db)

    group_opponents: list[GroupStageOpponent] = []
    group_opponent_row: GroupStageOpponent | None = None
    if is_group:
        group_opponents = await _group_opponents_for_session(draft_session_id, db)
        slot = GROUP_ROUND_TO_SLOT[current_round]
        group_opponent_row = next(o for o in group_opponents if o.slot == slot)
        opponent = await _group_opponent_full_stats(group_opponent_row, db)
    else:
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

    # El marcador se decide aqui (no mas abajo) porque group_stage necesita
    # los goles reales para acumular goals_for/goals_against -- si se
    # generase despues, el marcador que ve el usuario en la animacion podria
    # no coincidir con la diferencia de goles de la tabla del grupo.
    narrative = generate_match_events(
        {
            "result": outcome["result"],
            "win": outcome["win"],
            "draw": outcome["draw"],
            "loss": outcome["loss"],
            "explanation": explanation,
            "chemistry": team_stats["chemistry"],
            "team": team,
            "away_team": opponent["players"],
        }
    )
    score_home = narrative["score_home"]
    score_away = narrative["score_away"]

    penalties = None
    group_table = None
    parallel_match_serialized = None
    advanced: bool

    if is_group:
        assert group_opponent_row is not None
        if outcome["result"] == "win":
            user_points, opponent_points = 3, 0
        elif outcome["result"] == "loss":
            user_points, opponent_points = 0, 3
        else:
            user_points, opponent_points = 1, 1

        draft_session.group_points += user_points
        draft_session.group_goals_for += score_home
        draft_session.group_goals_against += score_away

        group_opponent_row.played = True
        group_opponent_row.points = opponent_points
        group_opponent_row.goals_for = score_away  # goles del rival = los que encaja el usuario
        group_opponent_row.goals_against = score_home  # goles que encaja el rival = los que mete el usuario

        # Los otros 2 rivales (los que no juegan contra el usuario esta
        # ronda) juegan entre si a la vez -- la misma jornada, dos partidos
        # a la vez, como en un grupo real: asi cuando el usuario termina
        # sus 3 partidos, el grupo ya tiene sus 6.
        other_pair = [o for o in group_opponents if o.slot != slot]
        assert len(other_pair) == 2
        # Se lee ANTES de simular y añadir el partido de esta ronda: la
        # sesion de SQLAlchemy hace autoflush antes de un SELECT, asi que
        # consultar despues de db.add(parallel_match) haria que este mismo
        # partido se colase en previous_rival_matches tambien -- contandolo
        # dos veces al construir rival_matches mas abajo.
        previous_rival_matches = await _rival_matches_for_session(draft_session_id, db)
        parallel_match = await _simulate_rival_match(other_pair[0], other_pair[1], db)
        rival_matches = [*previous_rival_matches, parallel_match]

        ranked = _rank_group(draft_session, group_opponents, rival_matches)
        group_complete = current_round == DraftRound.GROUP_3

        if group_complete:
            user_rank = next(i for i, row in enumerate(ranked) if row["is_user"])
            advanced = user_rank < 2  # top 2 de 4 clasifican a octavos
            draft_session.current_round = DraftRound.ROUND_OF_16 if advanced else DraftRound.ELIMINATED
        else:
            # Un partido de grupos nunca elimina por si solo (a diferencia
            # de las eliminatorias): se juegan los 3 pase lo que pase, y la
            # clasificacion se decide por tabla al terminar el group_3.
            advanced = True
            draft_session.current_round = ROUND_ORDER[ROUND_ORDER.index(current_round) + 1]

        other_matches = _serialize_other_matches(rival_matches, group_opponents)
        group_table = _serialize_group_table(ranked, group_complete, other_matches)
        parallel_match_serialized = _serialize_other_matches([parallel_match], group_opponents)[0]
    else:
        if outcome["result"] == "win":
            advanced = True
        elif outcome["result"] == "loss":
            advanced = False
        else:
            # Empate en eliminatorias: penaltis, sin ventaja para ningun lado.
            won_penalties = random.random() < 0.5
            penalties = {"took_place": True, "won_by_team": won_penalties}
            advanced = won_penalties

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
        "narrative": narrative,
        "group_table": group_table,
        # El partido rival-contra-rival que se simulo a la vez que este
        # (ver _simulate_rival_match); null fuera de la fase de grupos.
        "parallel_match": parallel_match_serialized,
    }
