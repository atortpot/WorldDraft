"""Scrapea las paginas 'X FIFA World Cup squads' de Wikipedia y vuelca
nombre, posicion, pais y anio de cada jugador convocado en data/squads.csv.
"""

import csv
import logging
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("scrape_squads")

YEARS = [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026]
URL_TEMPLATE = "https://en.wikipedia.org/wiki/{year}_FIFA_World_Cup_squads"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "squads.csv"

HEADERS = {
    "User-Agent": (
        "WorldDraft-DataImporter/0.1 "
        "(https://github.com/worlddraft; contact: amatortosapotous@gmail.com)"
    )
}
REQUEST_DELAY_SECONDS = 1


def parse_squads_page(html: str, year: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    body = soup.body or soup

    players = []
    current_country = None

    for tag in body.find_all(["h2", "h3", "table"]):
        if tag.name == "h3":
            current_country = tag.get_text(strip=True)
            continue

        if tag.name != "table" or current_country is None:
            continue

        rows = tag.find_all("tr", class_="nat-fs-player")
        if not rows:
            continue

        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            position_link = cells[1].find("a")
            position = (position_link or cells[1]).get_text(strip=True)

            name_cell = row.find("th", scope="row")
            if name_cell is None:
                continue
            name_link = name_cell.find("a")
            player_name = (name_link or name_cell).get_text(strip=True)

            players.append(
                {
                    "year": year,
                    "country": current_country,
                    "player_name": player_name,
                    "position": position,
                }
            )

        logger.info("  %s: %d jugadores", current_country, len(rows))
        current_country = None

    return players


def scrape_year(year: int) -> list[dict]:
    url = URL_TEMPLATE.format(year=year)
    logger.info("Procesando Mundial de %d (%s)...", year, url)
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    players = parse_squads_page(response.text, year)
    logger.info("Mundial de %d: %d jugadores en total", year, len(players))
    return players


def main() -> None:
    all_players: list[dict] = []
    for i, year in enumerate(YEARS):
        all_players.extend(scrape_year(year))
        if i < len(YEARS) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["year", "country", "player_name", "position"])
        writer.writeheader()
        writer.writerows(all_players)

    logger.info("Listo: %d jugadores guardados en %s", len(all_players), OUTPUT_PATH)


if __name__ == "__main__":
    main()
