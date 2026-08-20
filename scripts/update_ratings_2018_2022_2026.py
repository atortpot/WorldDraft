"""Actualiza goals/minutes_played/rating de los jugadores de 2018, 2022 y 2026
que quedaron en rating=0 tras el import inicial (WorldCupPlayers.csv no cubre
esos Mundiales), usando fuentes de datos especificas para cada uno:

- 2018/2022: player_appearances.csv (Fjelstul, minutos por titular/suplente)
  cruzado con matches_1930_2022.csv (goles, parseando "Nombre · minuto").
- 2026: player_stats.csv, que ya trae goals/assists/minutes_played listos.

El cruce exige coincidencia de (nombre, año, PAIS) -- sin el pais, dos
jugadores homonimos de paises distintos pueden cruzarse mal (se detecto un
caso real: un "Emiliano Martinez" argentino cruzando con un uruguayo
homonimo). Tambien usa la posicion como confirmacion extra para relajar el
umbral fuzzy en casos de diminutivo/nombre legal (ver NameMatcher).

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
from app.players.name_matching import NameMatcher, normalize_name, split_concatenated_name  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("update_ratings")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLAYER_APPEARANCES_CSV = DATA_DIR / "player_appearances.csv"
MATCHES_CSV = DATA_DIR / "matches_1930_2022.csv"
PLAYER_STATS_CSV = DATA_DIR / "player_stats.csv"

TOURNAMENT_IDS = {"WC-2018": 2018, "WC-2022": 2022}

POSITION_TO_ABBREVIATION = {
    PlayerPosition.GOALKEEPER: "GK",
    PlayerPosition.DEFENDER: "DF",
    PlayerPosition.MIDFIELDER: "MF",
    PlayerPosition.FORWARD: "FW",
}

# player_stats.csv usa "DEF"/"MID"/"FWD"/"GK"; el resto del proyecto usa
# "DF"/"MF"/"FW"/"GK" (ver app/players/importer.py POSITION_MAP).
PLAYER_STATS_POSITION_MAP = {"GK": "GK", "DEF": "DF", "MID": "MF", "FWD": "FW"}

# player_stats.csv (Mundial 2026) solo trae team_id numerico, sin nombre de
# pais. Se reconstruyo cruzando por nombre exacto contra los jugadores 2026
# ya existentes en la tabla players (voto mayoritario por team_id, sin
# ningun team_id con votos mezclados) y verificando manualmente con
# jugadores inequivocos los team_id sin ningun voto (p.ej. Brasil, cuyos
# nombres estan todos concatenados y por eso nunca cruzan por nombre
# exacto). Ver la investigacion de feature/improve-matching para el detalle.
PLAYER_STATS_TEAM_ID_TO_COUNTRY = {
    "1": "Mexico",
    "2": "South Africa",
    "3": "South Korea",
    "4": "Czech Republic",
    "5": "Canada",
    "6": "Bosnia and Herzegovina",
    "7": "Qatar",
    "8": "Switzerland",
    "9": "Brazil",
    "10": "Morocco",
    "11": "Haiti",
    "12": "Scotland",
    "13": "United States",
    "14": "Paraguay",
    "15": "Australia",
    "16": "Turkey",
    "17": "Germany",
    "18": "Curaçao",
    "19": "Ivory Coast",
    "20": "Ecuador",
    "21": "Netherlands",
    "22": "Japan",
    "23": "Sweden",
    "24": "Tunisia",
    "25": "Belgium",
    "26": "Egypt",
    "27": "Iran",
    "28": "New Zealand",
    "29": "Spain",
    "30": "Cape Verde",
    "31": "Saudi Arabia",
    "32": "Uruguay",
    "33": "France",
    "34": "Senegal",
    "35": "Iraq",
    "36": "Norway",
    "37": "Argentina",
    "38": "Algeria",
    "39": "Austria",
    "40": "Jordan",
    "41": "Portugal",
    "42": "DR Congo",
    "43": "Uzbekistan",
    "44": "Colombia",
    "45": "England",
    "46": "Croatia",
    "47": "Ghana",
    "48": "Panama",
}


def calculate_rating(goals: int, assists: int, minutes_played: int) -> float:
    return goals * 3 + assists * 1.5 + minutes_played / 90


def _load_minutes_and_positions_2018_2022() -> tuple[dict[tuple[str, int, str], int], dict[tuple[str, int, str], str]]:
    """(nombre normalizado, año, pais) -> minutos / -> posicion (GK/DF/MF/FW)."""
    minutes: dict[tuple[str, int, str], int] = defaultdict(int)
    positions: dict[tuple[str, int, str], str] = {}

    with PLAYER_APPEARANCES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = TOURNAMENT_IDS.get(row["tournament_id"])
            if year is None:
                continue

            country = to_fifa_ranking_country(row["team_name"].strip())
            name = f"{row['given_name']} {row['family_name']}".strip()
            key = (normalize_name(name), year, country)

            if row["starter"] == "1":
                minutes[key] += 90
            elif row["substitute"] == "1":
                minutes[key] += 45

            positions[key] = row["position_code"].strip()

    return minutes, positions


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
HOME_GOAL_COLUMNS = ("home_goal", "home_penalty_goal")
AWAY_GOAL_COLUMNS = ("away_goal", "away_penalty_goal")


def _load_goals_2018_2022() -> dict[tuple[str, int, str], int]:
    """(nombre normalizado, año, pais) -> goles, sumando goles de juego y de penalti."""
    goals: dict[tuple[str, int, str], int] = defaultdict(int)
    with MATCHES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Year"] not in ("2018", "2022"):
                continue
            year = int(row["Year"])

            home_country = to_fifa_ranking_country(row["home_team"].strip())
            away_country = to_fifa_ranking_country(row["away_team"].strip())

            for column in HOME_GOAL_COLUMNS:
                for name in _parse_scorers(row[column]):
                    goals[(normalize_name(name), year, home_country)] += 1
            for column in AWAY_GOAL_COLUMNS:
                for name in _parse_scorers(row[column]):
                    goals[(normalize_name(name), year, away_country)] += 1

    return goals


def _load_stats_2018_2022() -> tuple[dict[tuple[str, int, str], dict], dict[tuple[str, int, str], str]]:
    minutes_by_key, positions = _load_minutes_and_positions_2018_2022()
    goals_by_key = _load_goals_2018_2022()

    stats: dict[tuple[str, int, str], dict] = {}
    for key in set(minutes_by_key) | set(goals_by_key):
        stats[key] = {"goals": goals_by_key.get(key, 0), "minutes": minutes_by_key.get(key, 0)}
    return stats, positions


async def update_2018_2022(session) -> dict:
    stats_index, positions = _load_stats_2018_2022()
    matcher = NameMatcher(stats_index, positions)

    stmt = select(Player).where(Player.tournament_year.in_([2018, 2022]), Player.rating == 0)
    players = (await session.execute(stmt)).scalars().all()

    query_countries = {p.id: to_fifa_ranking_country(p.country) for p in players}
    for player in players:
        matcher.register_query_name(player.name, player.tournament_year, query_countries[player.id])

    updated_by_year = {2018: 0, 2022: 0}
    for player in players:
        stats = matcher.match(
            player.name,
            player.tournament_year,
            query_countries[player.id],
            position=POSITION_TO_ABBREVIATION[player.position],
        )
        if stats is None:
            continue

        player.goals = stats["goals"]
        player.minutes_played = stats["minutes"]
        player.rating = calculate_rating(stats["goals"], player.assists, stats["minutes"])
        updated_by_year[player.tournament_year] += 1

    await session.commit()
    return {"by_year": updated_by_year, "match_types": matcher.stats}


def _load_player_stats_2026() -> tuple[dict[tuple[str, int, str], dict], dict[tuple[str, int, str], str]]:
    """(nombre normalizado, 2026, pais) -> stats / -> posicion (GK/DF/MF/FW).

    player_stats.csv usa el nombre legal completo (con segundos nombres,
    p.ej. "Aaron Buchanan Hickey") mientras que players.name (via
    squads.csv/Wikipedia) usa el nombre publico corto ("Aaron Hickey") --
    lo resuelve el fuzzy matching de NameMatcher. Un puñado de nombres
    vienen con el apellido pegado en mayusculas (p.ej. "MARQUINHOSMarcos"):
    split_concatenated_name los reconstruye antes de indexarlos.
    """
    stats_by_key: dict[tuple[str, int, str], dict] = {}
    positions: dict[tuple[str, int, str], str] = {}

    with PLAYER_STATS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            country = PLAYER_STATS_TEAM_ID_TO_COUNTRY.get(row["team_id"].strip())
            if country is None:
                continue

            raw_name = row["player_name"].strip()
            fixed_name = split_concatenated_name(raw_name) or raw_name
            key = (normalize_name(fixed_name), 2026, country)

            stats_by_key[key] = {
                "goals": int(row["goals"] or 0),
                "assists": int(row["assists"] or 0),
                "minutes_played": int(row["minutes_played"] or 0),
            }
            positions[key] = PLAYER_STATS_POSITION_MAP.get(row["position"].strip(), row["position"].strip())

    return stats_by_key, positions


async def update_2026(session) -> dict:
    stats_index, positions = _load_player_stats_2026()
    matcher = NameMatcher(stats_index, positions)

    stmt = select(Player).where(Player.tournament_year == 2026, Player.rating == 0)
    players = (await session.execute(stmt)).scalars().all()

    query_countries = {p.id: to_fifa_ranking_country(p.country) for p in players}
    for player in players:
        matcher.register_query_name(player.name, 2026, query_countries[player.id])

    updated = 0
    for player in players:
        stats = matcher.match(
            player.name,
            2026,
            query_countries[player.id],
            position=POSITION_TO_ABBREVIATION[player.position],
        )
        if stats is None:
            continue

        player.goals = stats["goals"]
        player.assists = stats["assists"]
        player.minutes_played = stats["minutes_played"]
        player.rating = calculate_rating(stats["goals"], stats["assists"], stats["minutes_played"])
        updated += 1

    await session.commit()
    return {"total": updated, "match_types": matcher.stats}


async def main() -> None:
    async with AsyncSessionLocal() as session:
        logger.info("Actualizando 2018/2022 (player_appearances.csv + matches_1930_2022.csv)...")
        updated_2018_2022 = await update_2018_2022(session)

        logger.info("Actualizando 2026 (player_stats.csv)...")
        updated_2026 = await update_2026(session)

    logger.info("")
    logger.info("=== Resumen ===")
    logger.info(
        "2018: %d jugadores actualizados (tipos de cruce combinados 2018+2022: %s)",
        updated_2018_2022["by_year"][2018],
        dict(updated_2018_2022["match_types"]),
    )
    logger.info("2022: %d jugadores actualizados", updated_2018_2022["by_year"][2022])
    logger.info(
        "2026: %d jugadores actualizados (tipos de cruce: %s)",
        updated_2026["total"],
        dict(updated_2026["match_types"]),
    )


if __name__ == "__main__":
    asyncio.run(main())
