"""Entrena el modelo de resultado de partido (victoria local / empate / victoria
visitante) con datos historicos de Mundiales cruzados con el ranking FIFA, y
guarda el modelo ganador en app/model/match_model.pkl.
"""

import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.model.fifa_data import (  # noqa: E402
    clean_worldcup_matches_team_name,
    fifa_points_at,
    load_fifa_points_lookup,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("train_model")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MODEL_PATH = Path(__file__).resolve().parent.parent / "app" / "model" / "match_model.pkl"

MIN_YEAR = 1994
GOALS_AVG_WINDOW = 5

FEATURE_COLUMNS = [
    "home_fifa_points",
    "away_fifa_points",
    "fifa_points_diff",
    "home_goals_scored_avg",
    "away_goals_scored_avg",
    "round_encoded",
]

# groups=1, octavos=2, cuartos=3, semis=4, final=5. El partido por el tercer
# puesto no estaba en la especificacion de 5 fases: se agrupa con semis (4)
# porque ocurre en la misma ronda del calendario que la final.
ROUND_ENCODING = {
    **{f"Group {letter}": 1 for letter in "ABCDEFGH"},
    "Round of 16": 2,
    "Quarter-finals": 3,
    "Semi-finals": 4,
    "Match for third place": 4,
    "Play-off for third place": 4,
    "Third place": 4,
    "Final": 5,
}


def load_matches() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "WorldCupMatches.csv")
    df = df.dropna(subset=["Year", "MatchID"]).drop_duplicates(subset=["MatchID"])
    df["Year"] = df["Year"].astype(int)
    df = df[df["Year"] >= MIN_YEAR].copy()

    df["Home Team Name"] = df["Home Team Name"].apply(clean_worldcup_matches_team_name)
    df["Away Team Name"] = df["Away Team Name"].apply(clean_worldcup_matches_team_name)
    # El campo mezcla "03 Jun 1994" y "03 June 2002" segun el Mundial.
    df["match_date"] = pd.to_datetime(df["Datetime"].str.strip(), format="mixed", dayfirst=True)
    df["round_encoded"] = df["Stage"].map(ROUND_ENCODING)

    unmapped = df.loc[df["round_encoded"].isna(), "Stage"].unique()
    if len(unmapped):
        raise ValueError(f"Etapas sin mapear en ROUND_ENCODING: {list(unmapped)}")
    df["round_encoded"] = df["round_encoded"].astype(int)

    return df.sort_values("match_date").reset_index(drop=True)


def _fifa_points_or_raise(country: str, date: pd.Timestamp) -> float:
    points = fifa_points_at(country, date)
    if points is None:
        raise KeyError(f"Sin ranking FIFA para el equipo {country!r}")
    return points


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    # Carga y cachea el lookup de puntos FIFA una sola vez para todo el dataset.
    load_fifa_points_lookup()

    # Prior neutro para el primer partido de un equipo en el torneo, cuando
    # todavia no tiene historial de goles propio ese Mundial.
    global_goals_avg = pd.concat([df["Home Team Goals"], df["Away Team Goals"]]).mean()

    goals_history: dict[tuple[int, str], list[float]] = {}
    rows = []

    for _, match in df.iterrows():
        year = match["Year"]
        home, away = match["Home Team Name"], match["Away Team Name"]

        home_hist = goals_history.get((year, home), [])
        away_hist = goals_history.get((year, away), [])

        home_goals_scored_avg = (
            float(np.mean(home_hist[-GOALS_AVG_WINDOW:])) if home_hist else global_goals_avg
        )
        away_goals_scored_avg = (
            float(np.mean(away_hist[-GOALS_AVG_WINDOW:])) if away_hist else global_goals_avg
        )

        home_fifa_points = _fifa_points_or_raise(home, match["match_date"])
        away_fifa_points = _fifa_points_or_raise(away, match["match_date"])

        home_goals = match["Home Team Goals"]
        away_goals = match["Away Team Goals"]
        if home_goals > away_goals:
            outcome = 0
        elif home_goals == away_goals:
            outcome = 1
        else:
            outcome = 2

        rows.append(
            {
                "year": year,
                "home_fifa_points": home_fifa_points,
                "away_fifa_points": away_fifa_points,
                "fifa_points_diff": home_fifa_points - away_fifa_points,
                "home_goals_scored_avg": home_goals_scored_avg,
                "away_goals_scored_avg": away_goals_scored_avg,
                "round_encoded": match["round_encoded"],
                "outcome": outcome,
            }
        )

        goals_history.setdefault((year, home), []).append(float(home_goals))
        goals_history.setdefault((year, away), []).append(float(away_goals))

    return pd.DataFrame(rows)


def evaluate_leave_one_tournament_out(model, features: pd.DataFrame) -> dict:
    X = features[FEATURE_COLUMNS].to_numpy()
    y = features["outcome"].to_numpy()
    groups = features["year"].to_numpy()

    logo = LeaveOneGroupOut()
    all_true, all_pred, all_proba = [], [], []

    for train_idx, test_idx in logo.split(X, y, groups):
        fold_model = _clone_model(model)
        fold_model.fit(X[train_idx], y[train_idx])

        proba = fold_model.predict_proba(X[test_idx])
        pred = fold_model.classes_[np.argmax(proba, axis=1)]

        all_true.extend(y[test_idx])
        all_pred.extend(pred)
        all_proba.extend(proba)

        held_out_year = int(groups[test_idx][0])
        logger.info(
            "    fold %s (test) -> accuracy=%.3f log_loss=%.3f",
            held_out_year,
            accuracy_score(y[test_idx], pred),
            log_loss(y[test_idx], proba, labels=[0, 1, 2]),
        )

    return {
        "accuracy": accuracy_score(all_true, all_pred),
        "log_loss": log_loss(all_true, all_proba, labels=[0, 1, 2]),
    }


def _clone_model(model):
    from sklearn.base import clone

    return clone(model)


def main() -> None:
    logger.info("Cargando y cruzando datos (WorldCupMatches + fifa_ranking)...")
    matches = load_matches()
    features = build_features(matches)
    logger.info("Dataset de entrenamiento: %d partidos (Mundiales %s)", len(features), sorted(features["year"].unique()))

    models = {
        "logistic_regression": Pipeline(
            [
                ("scaler", StandardScaler()),
                # Con >2 clases y solver lbfgs (default), scikit-learn ya
                # ajusta una regresion logistica multinomial automaticamente.
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        ),
        "random_forest": RandomForestClassifier(n_estimators=300, max_depth=5, random_state=42),
    }

    results = {}
    for name, model in models.items():
        logger.info("Evaluando %s con leave-one-tournament-out...", name)
        results[name] = evaluate_leave_one_tournament_out(model, features)

    logger.info("")
    logger.info("=== Resumen ===")
    for name, metrics in results.items():
        logger.info("%s: accuracy=%.3f log_loss=%.3f", name, metrics["accuracy"], metrics["log_loss"])

    # Log-loss es la metrica que importa aqui: el simulador samplea de la
    # distribucion de probabilidad, no solo predice la clase mas probable,
    # asi que preferimos el modelo mejor calibrado aunque su accuracy sea
    # ligeramente menor.
    winner_name = min(results, key=lambda name: results[name]["log_loss"])
    logger.info("Modelo ganador (menor log_loss): %s", winner_name)

    logger.info("Reentrenando %s con todos los datos disponibles...", winner_name)
    winner_model = models[winner_name]
    X = features[FEATURE_COLUMNS].to_numpy()
    y = features["outcome"].to_numpy()
    winner_model.fit(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(winner_model, MODEL_PATH)
    logger.info("Modelo guardado en %s", MODEL_PATH)


if __name__ == "__main__":
    main()
