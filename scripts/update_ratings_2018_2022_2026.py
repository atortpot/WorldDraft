"""Actualiza goals/minutes_played/rating de los jugadores de 2018, 2022 y 2026
que quedaron en rating=0 tras el import inicial (WorldCupPlayers.csv no cubre
esos Mundiales), usando fuentes de datos especificas para cada uno:

- 2018/2022: player_appearances.csv (Fjelstul, minutos por titular/suplente)
  cruzado con matches_1930_2022.csv (goles, parseando "Nombre · minuto").
- 2026: player_stats.csv, que ya trae goals/assists/minutes_played listos.

Solo toca jugadores con rating == 0 en la tabla players; el resto se deja
intacto.
"""

import asyncio
import csv
import logging
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.db.database import AsyncSessionLocal  # noqa: E402
from app.db.models import Player  # noqa: E402
from app.players.importer import normalize_name  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("update_ratings")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLAYER_APPEARANCES_CSV = DATA_DIR / "player_appearances.csv"
MATCHES_CSV = DATA_DIR / "matches_1930_2022.csv"
PLAYER_STATS_CSV = DATA_DIR / "player_stats.csv"

TOURNAMENT_IDS = {"WC-2018": 2018, "WC-2022": 2022}


def calculate_rating(goals: int, assists: int, minutes_played: int) -> float:
    return goals * 3 + assists * 1.5 + minutes_played / 90


def _load_minutes_2018_2022() -> dict[tuple[str, int], int]:
    """(nombre normalizado, año) -> minutos, sumando titular=90 / suplente=45."""
    minutes: dict[tuple[str, int], int] = defaultdict(int)
    with PLAYER_APPEARANCES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = TOURNAMENT_IDS.get(row["tournament_id"])
            if year is None:
                continue

            name = f"{row['given_name']} {row['family_name']}".strip()
            key = (normalize_name(name), year)

            if row["starter"] == "1":
                minutes[key] += 90
            elif row["substitute"] == "1":
                minutes[key] += 45

    return minutes


def _parse_scorers(cell: str) -> list[str]:
    """'Nombre · min|Nombre (P) · min' -> ['Nombre', 'Nombre']. Los autogoles
    van en columnas aparte (home_own_goal/away_own_goal), no aqui."""
    if not cell:
        return []
    names = []
    for entry in cell.split("|"):
        entry = entry.strip()
        if not entry:
            continue
        name, _, _minute = entry.rpartition(" · ")
        name = name.removesuffix(" (P)")
        if name:
            names.append(name)
    return names


# home_goal/away_goal excluyen los goles marcados de penalti: van aparte en
# home_penalty_goal/away_penalty_goal (formato "Nombre (P) · minuto").
GOAL_COLUMNS = ("home_goal", "away_goal", "home_penalty_goal", "away_penalty_goal")


def _load_goals_2018_2022() -> dict[tuple[str, int], int]:
    """(nombre normalizado, año) -> goles, sumando goles de juego y de penalti."""
    goals: dict[tuple[str, int], int] = defaultdict(int)
    with MATCHES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Year"] not in ("2018", "2022"):
                continue
            year = int(row["Year"])

            scorers = [name for column in GOAL_COLUMNS for name in _parse_scorers(row[column])]
            for name in scorers:
                goals[(normalize_name(name), year)] += 1

    return goals


async def update_2018_2022(session) -> dict[int, int]:
    minutes_by_key = _load_minutes_2018_2022()
    goals_by_key = _load_goals_2018_2022()

    stmt = select(Player).where(Player.tournament_year.in_([2018, 2022]), Player.rating == 0)
    players = (await session.execute(stmt)).scalars().all()

    updated_by_year = {2018: 0, 2022: 0}
    for player in players:
        key = (normalize_name(player.name), player.tournament_year)
        goals = goals_by_key.get(key, 0)
        minutes = minutes_by_key.get(key, 0)
        if goals == 0 and minutes == 0:
            continue

        player.goals = goals
        player.minutes_played = minutes
        player.rating = calculate_rating(goals, player.assists, minutes)
        updated_by_year[player.tournament_year] += 1

    await session.commit()
    return updated_by_year


def _first_last(normalized_name: str) -> str:
    """'AARON BUCHANAN HICKEY' -> 'AARON HICKEY'. player_stats.csv usa el
    nombre legal completo (con segundos nombres); players.name (via
    squads.csv/Wikipedia) usa el nombre publico corto, normalmente de solo
    dos palabras: primer nombre + apellido son el punto de cruce comun."""
    parts = normalized_name.split()
    if len(parts) < 2:
        return normalized_name
    return f"{parts[0]} {parts[-1]}"


def _load_player_stats_2026() -> tuple[dict[str, dict], dict[str, dict]]:
    """Devuelve (stats por nombre completo, stats por primera+ultima palabra).

    El segundo indice solo incluye claves primera+ultima palabra que
    identifican a un unico jugador dentro de player_stats.csv, para no
    atribuir stats de un jugador a otro homonimo parcial.
    """
    stats_by_full_name: dict[str, dict] = {}
    full_names_by_first_last: dict[str, set[str]] = defaultdict(set)

    with PLAYER_STATS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            full_name = normalize_name(row["player_name"])
            stats = {
                "goals": int(row["goals"] or 0),
                "assists": int(row["assists"] or 0),
                "minutes_played": int(row["minutes_played"] or 0),
            }
            stats_by_full_name[full_name] = stats
            full_names_by_first_last[_first_last(full_name)].add(full_name)

    stats_by_first_last = {
        key: stats_by_full_name[next(iter(names))]
        for key, names in full_names_by_first_last.items()
        if len(names) == 1
    }
    return stats_by_full_name, stats_by_first_last


async def update_2026(session) -> dict[str, int]:
    stats_by_full_name, stats_by_first_last = _load_player_stats_2026()

    stmt = select(Player).where(Player.tournament_year == 2026, Player.rating == 0)
    players = (await session.execute(stmt)).scalars().all()

    updated_full_name = 0
    updated_first_last = 0
    for player in players:
        normalized = normalize_name(player.name)
        stats = stats_by_full_name.get(normalized)
        if stats is not None:
            updated_full_name += 1
        else:
            stats = stats_by_first_last.get(_first_last(normalized))
            if stats is not None:
                updated_first_last += 1

        if stats is None:
            continue

        player.goals = stats["goals"]
        player.assists = stats["assists"]
        player.minutes_played = stats["minutes_played"]
        player.rating = calculate_rating(stats["goals"], stats["assists"], stats["minutes_played"])

    await session.commit()
    return {"full_name": updated_full_name, "first_last_fallback": updated_first_last}


async def main() -> None:
    async with AsyncSessionLocal() as session:
        logger.info("Actualizando 2018/2022 (player_appearances.csv + matches_1930_2022.csv)...")
        updated_2018_2022 = await update_2018_2022(session)

        logger.info("Actualizando 2026 (player_stats.csv)...")
        updated_2026 = await update_2026(session)

    total_2026 = updated_2026["full_name"] + updated_2026["first_last_fallback"]
    logger.info("")
    logger.info("=== Resumen ===")
    logger.info("2018: %d jugadores actualizados", updated_2018_2022[2018])
    logger.info("2022: %d jugadores actualizados", updated_2018_2022[2022])
    logger.info(
        "2026: %d jugadores actualizados (%d por nombre completo + %d por fallback primera+ultima palabra)",
        total_2026,
        updated_2026["full_name"],
        updated_2026["first_last_fallback"],
    )


if __name__ == "__main__":
    asyncio.run(main())
