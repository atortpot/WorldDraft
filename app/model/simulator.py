from pathlib import Path

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "match_model.pkl"

# Debe coincidir exactamente con FEATURE_COLUMNS de scripts/train_model.py
# (mismo orden), ya que el modelo serializado no guarda los nombres.
FEATURE_COLUMNS = [
    "home_fifa_points",
    "away_fifa_points",
    "fifa_points_diff",
    "home_goals_scored_avg",
    "away_goals_scored_avg",
    "round_encoded",
]

FEATURE_LABELS = {
    "home_fifa_points": "puntos FIFA de tu equipo",
    "away_fifa_points": "puntos FIFA del rival",
    "fifa_points_diff": "diferencia de puntos FIFA",
    "home_goals_scored_avg": "gol average de tu equipo",
    "away_goals_scored_avg": "gol average del rival",
    "round_encoded": "fase del torneo",
}

# Ronda por defecto cuando el llamante no especifica una: WorldDraft es un
# torneo de eliminacion directa, así que "final" (5) es el escenario tipico.
DEFAULT_ROUND_ENCODED = 5

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def _build_feature_vector(
    team_a_stats: dict, team_b_stats: dict, round_encoded: int, chemistry_bonus: float = 0.0
) -> np.ndarray:
    # La bonificacion de quimica (ver DraftSession/calculate_team_stats en
    # app/game/draft_service.py) se aplica aqui, sobre los fifa_points
    # efectivos que ve el modelo, no sobre el team_a_stats que se devuelve
    # en la respuesta de la API: no se toca el modelo serializado ni sus
    # coeficientes, solo el input que recibe.
    home_fifa_points = team_a_stats["fifa_points"] * (1 + chemistry_bonus)
    away_fifa_points = team_b_stats["fifa_points"]
    return np.array(
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


def simulate_match(
    team_a_stats: dict,
    team_b_stats: dict,
    round_encoded: int = DEFAULT_ROUND_ENCODED,
    chemistry_bonus: float = 0.0,
) -> dict:
    """Simula un partido entre dos equipos.

    team_a_stats / team_b_stats: dicts con "fifa_points" y "goals_avg" (y
    opcionalmente "player_rating_avg", que el modelo actual todavia no usa
    como feature: fue entrenado solo con puntos FIFA, media de goles y
    ronda del torneo). chemistry_bonus (0.10 = +10%) sube los fifa_points
    efectivos de team_a antes de construir el vector de features: es la
    via por la que la quimica de equipo influye en el resultado sin
    reentrenar el modelo.
    """
    model = _get_model()
    features = _build_feature_vector(team_a_stats, team_b_stats, round_encoded, chemistry_bonus)

    probabilities = model.predict_proba(features)[0]
    proba_by_class = dict(zip(model.classes_, probabilities))
    # 0 = victoria local (team_a), 1 = empate, 2 = victoria visitante (team_b)
    win = float(proba_by_class.get(0, 0.0))
    draw = float(proba_by_class.get(1, 0.0))
    loss = float(proba_by_class.get(2, 0.0))

    outcome = np.random.choice(["win", "draw", "loss"], p=[win, draw, loss])

    return {"win": win, "draw": draw, "loss": loss, "result": str(outcome)}


def explain_match(
    team_a_stats: dict,
    team_b_stats: dict,
    round_encoded: int = DEFAULT_ROUND_ENCODED,
    chemistry_bonus: float = 0.0,
) -> list[dict]:
    """Desglosa que variables inclinaron la prediccion, y hacia que lado.

    Solo funciona si el modelo cargado es lineal (Pipeline con StandardScaler
    + LogisticRegression, el ganador actual): se calcula la contribucion de
    cada feature a la diferencia de log-odds entre "victoria team_a" y
    "victoria team_b". Con otro tipo de modelo (p.ej. RandomForest) devuelve
    una lista vacia, ya que no hay una descomposicion lineal equivalente.
    """
    model = _get_model()
    steps = getattr(model, "named_steps", {})
    scaler = steps.get("scaler")
    clf = steps.get("clf")

    if scaler is None or clf is None or not hasattr(clf, "coef_"):
        return []

    features = _build_feature_vector(team_a_stats, team_b_stats, round_encoded, chemistry_bonus)
    scaled = scaler.transform(features)[0]

    class_index = {cls: i for i, cls in enumerate(clf.classes_)}
    if 0 not in class_index or 2 not in class_index:
        return []

    # positivo favorece a team_a (victoria local), negativo favorece a team_b
    coef_diff = clf.coef_[class_index[0]] - clf.coef_[class_index[2]]
    contributions = coef_diff * scaled

    ranked = sorted(zip(FEATURE_COLUMNS, contributions), key=lambda item: abs(item[1]), reverse=True)

    return [
        {
            "feature": name,
            "label": FEATURE_LABELS.get(name, name),
            "favors": "team_a" if value > 0 else "team_b",
            "weight": round(float(value), 3),
        }
        for name, value in ranked
    ]
