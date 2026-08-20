"""Recupera minutes_played/goals/rating para jugadores de 1994-2014 que
quedaron en rating=0 tras el import inicial (app/players/importer.py, que
solo usa WorldCupPlayers.csv) cruzandolos tambien contra player_appearances.csv
y goals.csv (Fjelstul), que cubren estos mismos Mundiales con datos mas
limpios.

Cruce en 3 niveles con NameMatcher: exige coincidencia de pais (ver
app/model/fifa_data.py) para evitar falsos positivos entre homonimos de
paises distintos.

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
from app.db.models import Player, PlayerPosition  # noqa: E402
from app.model.fifa_data import to_fifa_ranking_country  # noqa: E402
from app.players.name_matching import NameMatcher, normalize_name  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("update_ratings_1994_2014")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLAYER_APPEARANCES_CSV = DATA_DIR / "player_appearances.csv"
GOALS_CSV = DATA_DIR / "goals.csv"

YEARS = {1994, 1998, 2002, 2006, 2010, 2014}

POSITION_TO_ABBREVIATION = {
    PlayerPosition.GOALKEEPER: "GK",
    PlayerPosition.DEFENDER: "DF",
    PlayerPosition.MIDFIELDER: "MF",
    PlayerPosition.FORWARD: "FW",
}


def calculate_rating(goals: int, assists: int, minutes_played: int) -> float:
    return goals * 3 + assists * 1.5 + minutes_played / 90


def _build_name(given_name: str, family_name: str) -> str:
    """Fjelstul marca a los jugadores sin segundo nombre (mononimos, p.ej.
    Romario) con given_name="not applicable" en vez de dejarlo vacio."""
    given_name = given_name.strip()
    if given_name.lower() == "not applicable":
        return family_name.strip()
    return f"{given_name} {family_name}".strip()


def _tournament_year(tournament_id: str) -> int | None:
    if not tournament_id.startswith("WC-") or not tournament_id[3:].isdigit():
        return None
    year = int(tournament_id[3:])
    return year if year in YEARS else None


def _load_minutes_and_positions() -> tuple[dict[tuple[str, int, str], int], dict[tuple[str, int, str], str]]:
    """(nombre normalizado, año, pais) -> minutos / -> posicion (GK/DF/MF/FW)."""
    minutes: dict[tuple[str, int, str], int] = defaultdict(int)
    positions: dict[tuple[str, int, str], str] = {}

    with PLAYER_APPEARANCES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = _tournament_year(row["tournament_id"])
            if year is None:
                continue

            country = to_fifa_ranking_country(row["team_name"].strip())
            name = _build_name(row["given_name"], row["family_name"])
            key = (normalize_name(name), year, country)

            minutes[key] += 90 if row["starter"] == "1" else 45 if row["substitute"] == "1" else 0
            positions[key] = row["position_code"].strip()

    return minutes, positions


def _load_goals() -> dict[tuple[str, int, str], int]:
    """(nombre normalizado, año, pais) -> goles. Excluye autogoles."""
    goals: dict[tuple[str, int, str], int] = defaultdict(int)

    with GOALS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = _tournament_year(row["tournament_id"])
            if year is None or row["own_goal"] == "1":
                continue

            country = to_fifa_ranking_country(row["player_team_name"].strip())
            name = _build_name(row["given_name"], row["family_name"])
            key = (normalize_name(name), year, country)
            goals[key] += 1

    return goals


def _load_stats_1994_2014() -> tuple[dict[tuple[str, int, str], dict], dict[tuple[str, int, str], str]]:
    minutes_by_key, positions = _load_minutes_and_positions()
    goals_by_key = _load_goals()

    stats: dict[tuple[str, int, str], dict] = {}
    for key in set(minutes_by_key) | set(goals_by_key):
        stats[key] = {"goals": goals_by_key.get(key, 0), "minutes": minutes_by_key.get(key, 0)}
    return stats, positions


async def update_1994_2014(session) -> dict:
    stats_index, positions = _load_stats_1994_2014()
    matcher = NameMatcher(stats_index, positions)

    stmt = select(Player).where(Player.tournament_year.in_(YEARS), Player.rating == 0)
    players = (await session.execute(stmt)).scalars().all()

    query_countries = {p.id: to_fifa_ranking_country(p.country) for p in players}
    for player in players:
        matcher.register_query_name(player.name, player.tournament_year, query_countries[player.id])

    updated_by_year = {year: 0 for year in YEARS}
    for player in players:
        stats = matcher.match(
            player.name,
            player.tournament_year,
            query_countries[player.id],
            position=POSITION_TO_ABBREVIATION[player.position],
        )
        if stats is None or (stats["minutes"] == 0 and stats["goals"] == 0):
            continue

        player.goals = stats["goals"]
        player.minutes_played = stats["minutes"]
        player.rating = calculate_rating(stats["goals"], player.assists, stats["minutes"])
        updated_by_year[player.tournament_year] += 1

    await session.commit()
    return {"by_year": updated_by_year, "match_types": matcher.stats}


async def main() -> None:
    async with AsyncSessionLocal() as session:
        logger.info("Recuperando minutos+goles 1994-2014 desde player_appearances.csv + goals.csv (Fjelstul)...")
        result = await update_1994_2014(session)

    logger.info("")
    logger.info("=== Resumen ===")
    total = 0
    for year in sorted(result["by_year"]):
        count = result["by_year"][year]
        total += count
        logger.info("%d: %d jugadores recuperados", year, count)
    logger.info("Total: %d jugadores recuperados", total)
    logger.info("Tipos de cruce: %s", dict(result["match_types"]))


if __name__ == "__main__":
    asyncio.run(main())
