import csv
import re
from collections import defaultdict
from pathlib import Path

from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Player, PlayerPosition
from app.model.fifa_data import team_initials_to_country, to_fifa_ranking_country
from app.players.name_matching import NameMatcher, normalize_name

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SQUADS_CSV = DATA_DIR / "squads.csv"
PLAYERS_CSV = DATA_DIR / "WorldCupPlayers.csv"
MATCHES_CSV = DATA_DIR / "WorldCupMatches.csv"

MIN_YEAR = 1994
MATCH_MINUTES = 90

POSITION_MAP = {
    "GK": PlayerPosition.GOALKEEPER,
    "DF": PlayerPosition.DEFENDER,
    "MF": PlayerPosition.MIDFIELDER,
    "FW": PlayerPosition.FORWARD,
}

GOAL_EVENT_RE = re.compile(r"^G\d")
IN_MINUTE_RE = re.compile(r"^I(\d+)")
OUT_MINUTE_RE = re.compile(r"^O(\d+)")


def _parse_event(event: str) -> dict:
    """Extrae goles y el minuto de entrada/salida por sustitucion de un Event.

    Codigos: G<min> = gol, I<min>/O<min> = entra/sale por cambio,
    IH/OH = entra/sale en el descanso (min. 45 aprox).
    """
    goals = 0
    in_minute = None
    out_minute = None
    in_half = False
    out_half = False

    for token in event.split():
        if token.startswith("IH"):
            in_half = True
        elif token.startswith("OH"):
            out_half = True
        elif m := IN_MINUTE_RE.match(token):
            in_minute = int(m.group(1))
        elif m := OUT_MINUTE_RE.match(token):
            out_minute = int(m.group(1))
        elif GOAL_EVENT_RE.match(token):
            goals += 1

    return {
        "goals": goals,
        "in_minute": in_minute,
        "out_minute": out_minute,
        "in_half": in_half,
        "out_half": out_half,
    }


def _row_minutes(line_up: str, parsed_event: dict) -> int:
    """Minutos jugados en un partido segun si fue titular/suplente y si hubo cambio.

    Line-up == 'N' no significa "entro de cambio": son todos los jugadores que
    no fueron titulares, la mayoria se queda en el banquillo sin jugar. Solo
    cuenta minutos si el Event confirma que realmente entro al campo (I/IH).
    """
    if line_up == "S":
        if parsed_event["out_half"]:
            return 45
        if parsed_event["out_minute"] is not None:
            return min(parsed_event["out_minute"], MATCH_MINUTES)
        return MATCH_MINUTES
    if line_up == "N":
        if parsed_event["in_half"]:
            return 45
        if parsed_event["in_minute"] is not None:
            return max(MATCH_MINUTES - parsed_event["in_minute"], 0)
        return 0
    return 0


def _load_match_years() -> dict[str, int]:
    match_years: dict[str, int] = {}
    with MATCHES_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = row["Year"].strip()
            match_id = row["MatchID"].strip()
            if not year or not match_id:
                continue
            match_years[match_id] = int(year)
    return match_years


def _load_player_stats() -> dict[tuple[str, int, str], dict[str, int]]:
    """Agrega goles y minutos reales por (nombre normalizado, año, pais canonico)
    desde WorldCupPlayers.csv. El pais sale de Team Initials via WorldCupMatches.csv."""
    match_years = _load_match_years()
    stats: dict[tuple[str, int, str], dict[str, int]] = defaultdict(lambda: {"goals": 0, "minutes": 0})

    with PLAYERS_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            year = match_years.get(row["MatchID"].strip())
            if year is None or year < MIN_YEAR:
                continue

            player_name = row["Player Name"].strip()
            if not player_name:
                continue

            country = team_initials_to_country(row["Team Initials"].strip())
            if country is None:
                continue
            key = (normalize_name(player_name), year, country)

            parsed_event = _parse_event(row["Event"])
            stats[key]["goals"] += parsed_event["goals"]
            stats[key]["minutes"] += _row_minutes(row["Line-up"].strip(), parsed_event)

    return stats


async def import_players(session: AsyncSession) -> dict:
    player_stats = _load_player_stats()
    matcher = NameMatcher(player_stats)

    with SQUADS_CSV.open(encoding="utf-8") as f:
        squad_rows = [row for row in csv.DictReader(f) if int(row["year"]) >= MIN_YEAR]

    for row in squad_rows:
        canonical_country = to_fifa_ranking_country(row["country"].strip())
        matcher.register_query_name(row["player_name"].strip(), int(row["year"]), canonical_country)

    rows_to_upsert = []

    for row in squad_rows:
        year = int(row["year"])
        player_name = row["player_name"].strip()
        country = row["country"].strip()
        canonical_country = to_fifa_ranking_country(country)
        position = POSITION_MAP[row["position"].strip()]

        stats = matcher.match(player_name, year, canonical_country)

        goals = stats["goals"] if stats else 0
        minutes = stats["minutes"] if stats else 0
        assists = 0
        rating = goals * 3 + assists * 1.5 + minutes / 90

        rows_to_upsert.append(
            {
                "name": player_name,
                "country": country,
                "tournament_year": year,
                "position": position,
                "goals": goals,
                "assists": assists,
                "minutes_played": minutes,
                "rating": rating,
            }
        )

    # asyncpg limita a 32767 parametros por consulta; con 8 columnas por fila
    # el batch se mantiene muy por debajo de ese limite.
    BATCH_SIZE = 1000
    for i in range(0, len(rows_to_upsert), BATCH_SIZE):
        batch = rows_to_upsert[i : i + BATCH_SIZE]
        stmt = pg_insert(Player).values(batch)
        # Este import solo conoce WorldCupPlayers.csv (1994-2014). Si el
        # jugador ya tiene un rating mejor (p.ej. de scripts/update_ratings_*
        # con otras fuentes: Fjelstul, player_stats.csv 2026), no lo
        # pisamos con datos peores (o en 0, para años que esta fuente ni
        # siquiera cubre como 2018+). Se compara el conjunto completo, no
        # campo a campo, para no mezclar goles de una fuente con minutos
        # de otra.
        keep_new = stmt.excluded.rating > Player.rating
        stmt = stmt.on_conflict_do_update(
            index_elements=["name", "country", "tournament_year"],
            set_={
                "position": stmt.excluded.position,
                "goals": case((keep_new, stmt.excluded.goals), else_=Player.goals),
                "assists": case((keep_new, stmt.excluded.assists), else_=Player.assists),
                "minutes_played": case(
                    (keep_new, stmt.excluded.minutes_played), else_=Player.minutes_played
                ),
                "rating": case((keep_new, stmt.excluded.rating), else_=Player.rating),
            },
        )
        await session.execute(stmt)
    await session.commit()

    return {
        "imported": len(rows_to_upsert),
        "matched_full_name": matcher.stats["exact"],
        "matched_surname_fallback": matcher.stats["surname"],
        "matched_fuzzy": matcher.stats["fuzzy"],
        "unmatched_without_stats": matcher.stats["unmatched"],
    }
