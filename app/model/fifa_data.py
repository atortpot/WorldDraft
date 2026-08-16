"""Resolucion de nombres de pais y lookup de puntos FIFA compartidos entre el
script de entrenamiento y el servicio de draft.

Las tres fuentes de datos nombran a los paises de forma distinta:
- fifa_ranking-2024-06-20.csv (country_full) es el nombre canonico que usamos.
- WorldCupMatches.csv usa nombres de equipo con algunas variantes/errores de
  codificacion propios del CSV original.
- squads.csv / Player.country vienen del scraping de Wikipedia, con sus
  propias variantes.
"""

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
FIFA_RANKING_CSV = DATA_DIR / "fifa_ranking-2024-06-20.csv"
WORLDCUP_MATCHES_CSV = DATA_DIR / "WorldCupMatches.csv"

# WorldCupMatches.csv -> nombre canonico (fifa_ranking country_full)
WORLDCUP_MATCHES_TEAM_ALIASES = {
    "Iran": "IR Iran",
    "Czech Republic": "Czechia",
}

# squads.csv / Player.country (Wikipedia) -> nombre canonico (fifa_ranking country_full)
WIKI_SQUADS_COUNTRY_ALIASES = {
    "Cape Verde": "Cabo Verde",
    "Curaçao": "Curacao",
    "Czech Republic": "Czechia",
    "DR Congo": "Congo DR",
    "FR Yugoslavia": "Yugoslavia",
    "Iran": "IR Iran",
    "Ivory Coast": "Côte d'Ivoire",
    "North Korea": "Korea DPR",
    "South Korea": "Korea Republic",
    "United States": "USA",
}
INVERSE_WIKI_SQUADS_ALIASES = {canonical: wiki for wiki, canonical in WIKI_SQUADS_COUNTRY_ALIASES.items()}

# WorldCupMatches.csv solo cubre Mundiales hasta 2014; para los posteriores
# (que si estan en squads.csv/players) usamos las fechas reales de inicio.
KNOWN_TOURNAMENT_START_DATES = {
    2018: "2018-06-14",
    2022: "2022-11-20",
    2026: "2026-06-11",
}


def clean_worldcup_matches_team_name(name: str) -> str:
    name = name.strip()
    if name.startswith('rn">'):
        name = name[len('rn">') :]
    if "Ivoire" in name:
        # El CSV original ya trae el caracter de "Cote" corrupto en origen.
        name = "Côte d'Ivoire"
    return WORLDCUP_MATCHES_TEAM_ALIASES.get(name, name)


def to_fifa_ranking_country(squads_country: str) -> str:
    """Nombre de Player.country (Wikipedia) -> nombre canonico de fifa_ranking."""
    return WIKI_SQUADS_COUNTRY_ALIASES.get(squads_country, squads_country)


def to_squads_country_name(canonical_country: str) -> str:
    """Nombre canonico (fifa_ranking / WorldCupMatches ya resuelto) -> Player.country."""
    return INVERSE_WIKI_SQUADS_ALIASES.get(canonical_country, canonical_country)


_fifa_points_lookup: dict[str, pd.Series] | None = None


def load_fifa_points_lookup() -> dict[str, pd.Series]:
    global _fifa_points_lookup
    if _fifa_points_lookup is None:
        df = pd.read_csv(FIFA_RANKING_CSV)
        df["rank_date"] = pd.to_datetime(df["rank_date"])
        _fifa_points_lookup = {
            country: group.set_index("rank_date")["total_points"].sort_index()
            for country, group in df.groupby("country_full")
        }
    return _fifa_points_lookup


def fifa_points_at(canonical_country: str, date) -> float | None:
    if date is None:
        return None
    series = load_fifa_points_lookup().get(canonical_country)
    if series is None:
        return None
    value = series.asof(date)
    if pd.isna(value):
        # El partido/torneo es anterior al primer ranking FIFA disponible:
        # usamos el primer valor conocido como mejor aproximacion.
        value = series.iloc[0]
    return float(value)


_tournament_start_dates: dict[int, pd.Timestamp] | None = None


def load_tournament_start_dates() -> dict[int, pd.Timestamp]:
    global _tournament_start_dates
    if _tournament_start_dates is None:
        df = pd.read_csv(WORLDCUP_MATCHES_CSV)
        df = df.dropna(subset=["Year"]).copy()
        df["Year"] = df["Year"].astype(int)
        df["match_date"] = pd.to_datetime(df["Datetime"].str.strip(), format="mixed", dayfirst=True)
        dates = df.groupby("Year")["match_date"].min().to_dict()
        for year, date_str in KNOWN_TOURNAMENT_START_DATES.items():
            dates.setdefault(year, pd.Timestamp(date_str))
        _tournament_start_dates = dates
    return _tournament_start_dates


def tournament_start_date(year: int) -> pd.Timestamp | None:
    return load_tournament_start_dates().get(year)
