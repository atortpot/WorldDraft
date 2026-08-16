from pathlib import Path

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "match_model.pkl"

# Ronda por defecto cuando el llamante no especifica una: WorldDraft es un
# torneo de eliminacion directa, así que "final" (5) es el escenario tipico.
DEFAULT_ROUND_ENCODED = 5

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def simulate_match(
    team_a_stats: dict,
    team_b_stats: dict,
    round_encoded: int = DEFAULT_ROUND_ENCODED,
) -> dict:
    """Simula un partido entre dos equipos.

    team_a_stats / team_b_stats: dicts con "fifa_points" y "goals_avg" (y
    opcionalmente "player_rating_avg", que el modelo actual todavia no usa
    como feature: fue entrenado solo con puntos FIFA, media de goles y
    ronda del torneo).
    """
    model = _get_model()

    home_fifa_points = team_a_stats["fifa_points"]
    away_fifa_points = team_b_stats["fifa_points"]

    features = np.array(
        [
            [
                home_fifa_points,
                away_fifa_points,
                home_fifa_points - away_fifa_points,
                team_a_stats["goals_avg"],
                team_b_stats["goals_avg"],
                round_encoded,
            ]
        ]
    )

    probabilities = model.predict_proba(features)[0]
    proba_by_class = dict(zip(model.classes_, probabilities))
    # 0 = victoria local (team_a), 1 = empate, 2 = victoria visitante (team_b)
    win = float(proba_by_class.get(0, 0.0))
    draw = float(proba_by_class.get(1, 0.0))
    loss = float(proba_by_class.get(2, 0.0))

    outcome = np.random.choice(["win", "draw", "loss"], p=[win, draw, loss])

    return {"win": win, "draw": draw, "loss": loss, "result": str(outcome)}
