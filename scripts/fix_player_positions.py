"""Corrige la posicion de jugadores concretos en la tabla players cuando el
scraping de las paginas de convocatorias de Wikipedia produjo una posicion
que no refleja la posicion real del jugador (o la que jugo en ese Mundial
concreto).

Los casos de este diccionario se identificaron cruzando dos señales
independientes contra el resto de la BD y contra player_appearances.csv
(Fjelstul, cubre WC-1994 a WC-2022):

1. Consistencia historica: el mismo jugador real (mismo nombre+pais)
   aparece en varios Mundiales de nuestra BD: si su posicion es igual en
   todos menos en uno, ese año suelto es sospechoso.
2. Cruce con player_appearances.csv: la posicion mayoritaria con la que
   jugo sus partidos de ese Mundial segun Fjelstul.

Un analisis puramente automatico de estas dos señales genera muchos falsos
positivos (conversiones reales de posicion a lo largo de la carrera --
p.ej. Fernando Hierro o Javier Mascherano acabando de central -- y
jugadores homonimos distintos que comparten apodo, p.ej. "Beto" de
Portugal). Por eso esto es un diccionario manual, no una correccion
automatica: cada entrada se confirmo con la posicion real conocida del
jugador, no solo con la señal estadistica.

Uso:
    uv run python scripts/fix_player_positions.py           # aplica los cambios
    uv run python scripts/fix_player_positions.py --dry-run # solo muestra que haria
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.db.database import AsyncSessionLocal  # noqa: E402
from app.db.models import Player, PlayerPosition  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("fix_player_positions")

# Clave: (nombre exacto en players.name, country, tournament_year).
# Valor: (posicion actual esperada, posicion correcta). La posicion actual
# esperada es una comprobacion de seguridad: si no coincide con lo que hay
# en BD (p.ej. porque ya se corrigio, o el dato cambio de forma
# inesperada), la entrada se salta y se avisa en vez de sobreescribir a
# ciegas.
POSITION_FIXES: dict[tuple[str, str, int], tuple[PlayerPosition, PlayerPosition]] = {
    # Lateral izquierdo de Canada (Bayern/Vancouver): en 2026 ya esta bien
    # (defender). El resto de su carrera y el sentido comun confirman que
    # nunca ha jugado de delantero.
    ("Alphonso Davies", "Canada", 2022): (PlayerPosition.FORWARD, PlayerPosition.DEFENDER),
    # Centrocampista (libero ofensivo) legendario de Alemania: en BD ya esta
    # bien como midfielder en 1994; player_appearances.csv confirma DFx3 en
    # 1998 pero es el año suelto, no el patron real de su carrera.
    ("Lothar Matthäus", "Germany", 1998): (PlayerPosition.DEFENDER, PlayerPosition.MIDFIELDER),
    # Lateral derecho belga (Dortmund/PSG/Trabzonspor): 2018 y 2026 ya estan
    # bien como defender en BD; player_appearances.csv 2022 confirma RBx2
    # frente a MFx1.
    ("Thomas Meunier", "Belgium", 2022): (PlayerPosition.MIDFIELDER, PlayerPosition.DEFENDER),
    # Centrocampista mexicano (Porto/Houston Dynamo): 2014 y 2022 ya estan
    # bien como midfielder en BD; player_appearances.csv 2018 confirma CMx4
    # unanime.
    ("Héctor Herrera", "Mexico", 2018): (PlayerPosition.DEFENDER, PlayerPosition.MIDFIELDER),
    # Lateral izquierdo mexicano (Rayados de Monterrey): 2022 y 2026 ya
    # estan bien como defender en BD; player_appearances.csv 2018 confirma
    # LBx4 unanime.
    ("Jesús Gallardo", "Mexico", 2018): (PlayerPosition.MIDFIELDER, PlayerPosition.DEFENDER),
    # Centrocampista/extremo portugues (Manchester City): 2018 y 2026 ya
    # estan bien como midfielder en BD; player_appearances.csv 2022 confirma
    # mayoria CM/AM (4) frente a FW (1).
    ("Bernardo Silva", "Portugal", 2022): (PlayerPosition.FORWARD, PlayerPosition.MIDFIELDER),
    # Delantero/extremo aleman (Koln/Arsenal/Bayern): 2006 y 2014 ya estan
    # bien como forward en BD; player_appearances.csv 2010 confirma LWx6
    # unanime.
    ("Lukas Podolski", "Germany", 2010): (PlayerPosition.MIDFIELDER, PlayerPosition.FORWARD),
    # Mediapunta uruguayo (Flamengo): 2022 y 2026 ya estan bien como
    # midfielder en BD; player_appearances.csv 2018 confirma LM/MF frente a
    # ningun apoyo de forward.
    ("Giorgian de Arrascaeta", "Uruguay", 2018): (PlayerPosition.FORWARD, PlayerPosition.MIDFIELDER),
    # Extremo/delantero saudi (Al-Hilal, gol famoso a Argentina en 2022):
    # 2022 y 2026 ya estan bien como forward en BD; player_appearances.csv
    # 2018 confirma RW/LW frente a ningun apoyo de midfielder.
    ("Salem Al-Dawsari", "Saudi Arabia", 2018): (PlayerPosition.MIDFIELDER, PlayerPosition.FORWARD),
}


async def apply_position_fixes(session) -> dict:
    updated = []
    skipped = []
    not_found = []

    for (name, country, year), (expected_current, correct) in POSITION_FIXES.items():
        stmt = select(Player).where(
            Player.name == name, Player.country == country, Player.tournament_year == year
        )
        player = (await session.execute(stmt)).scalar_one_or_none()

        if player is None:
            not_found.append((name, country, year))
            continue

        if player.position != expected_current:
            skipped.append((name, country, year, player.position, expected_current))
            continue

        player.position = correct
        updated.append((name, country, year, expected_current, correct))

    await session.commit()
    return {"updated": updated, "skipped": skipped, "not_found": not_found}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="Solo muestra que cambios haria, sin escribir en la BD"
    )
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        if args.dry_run:
            logger.info("--dry-run: comprobando estado actual sin escribir en la BD\n")
            for (name, country, year), (expected_current, correct) in POSITION_FIXES.items():
                stmt = select(Player).where(
                    Player.name == name, Player.country == country, Player.tournament_year == year
                )
                player = (await session.execute(stmt)).scalar_one_or_none()
                if player is None:
                    logger.info("NO ENCONTRADO: %s (%s %d)", name, country, year)
                elif player.position != expected_current:
                    logger.info(
                        "SALTARIA (posicion actual %s != esperada %s): %s (%s %d)",
                        player.position.value, expected_current.value, name, country, year,
                    )
                else:
                    logger.info(
                        "CORREGIRIA: %s (%s %d): %s -> %s",
                        name, country, year, expected_current.value, correct.value,
                    )
            return

        result = await apply_position_fixes(session)

    logger.info("=== Resumen ===")
    for name, country, year, before, after in result["updated"]:
        logger.info("Corregido: %s (%s %d): %s -> %s", name, country, year, before.value, after.value)
    for name, country, year, actual, expected in result["skipped"]:
        logger.warning(
            "Saltado (posicion actual %s no coincide con la esperada %s): %s (%s %d)",
            actual.value, expected.value, name, country, year,
        )
    for name, country, year in result["not_found"]:
        logger.warning("No encontrado en BD: %s (%s %d)", name, country, year)

    logger.info(
        "Total: %d corregidos, %d saltados, %d no encontrados (de %d casos)",
        len(result["updated"]), len(result["skipped"]), len(result["not_found"]), len(POSITION_FIXES),
    )


if __name__ == "__main__":
    asyncio.run(main())
