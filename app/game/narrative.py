"""Genera un relato minuto a minuto (marcador + eventos + frase de cierre)
de un partido ya resuelto por app/model/simulator.py.

Es puramente de presentacion: no decide quien gana, solo dramatiza con
cierto criterio futbolistico un resultado y unas probabilidades que ya
existen. No usa el modelo ni ningun dato adicional del rival (no tenemos
jugadores reales del lado visitante, solo etiquetas genericas).
"""

import random

MIN_EVENT_MINUTE = 5
MAX_EVENT_MINUTE = 90
MIN_CARD_MINUTE = 6
SECOND_HALF_START = 46

# Marcadores posibles segun cuan "convincente" fue el resultado. Se usa la
# probabilidad del resultado que realmente ocurrio: >=60% -> marcador
# contundente, si no, ajustado. (goles_a_favor, goles_en_contra).
_DECISIVE_SCORELINES = [(2, 0), (3, 0), (3, 1), (4, 1)]
_NARROW_SCORELINES = [(1, 0), (2, 1)]
_DRAW_SCORELINES = [(0, 0), (1, 1), (1, 1), (2, 2)]
_DECISIVE_THRESHOLD = 0.60

_CENTRAL_SLOTS = {"CB", "CDM", "CM", "CAM"}

_PENALTY_GOAL_CHANCE = 0.22
_PENALTY_MISS_CHANCE = 0.25
_RED_CARD_CHANCE = 0.12  # incluso cumpliendo el resto de condiciones, es rara
_RED_CARD_PROB_MARGIN = 0.15
MAX_YELLOW_CARDS = 4

_GENERIC_RIVAL_SCORERS = [
    "Jugador rival",
    "Delantero rival",
    "Centrocampista rival",
    "Defensa rival",
]
_GENERIC_RIVAL_YELLOW = ["Defensa rival", "Centrocampista rival"]
_GENERIC_RIVAL_YELLOW_RARE = ["Portero rival", "Delantero rival"]
_GENERIC_RIVAL_RED_CENTRAL = ["Defensa central rival", "Centrocampista rival"]
_GENERIC_RIVAL_PENALTY_TAKERS = ["Delantero rival", "Centrocampista rival"]


def _pick_score(result: str, win: float, draw: float, loss: float) -> tuple[int, int]:
    """(goles de tu equipo, goles del rival), coherente con el resultado."""
    if result == "draw":
        return random.choice(_DRAW_SCORELINES)

    if result == "win":
        confidence = win
        pool = _DECISIVE_SCORELINES if confidence >= _DECISIVE_THRESHOLD else _NARROW_SCORELINES
        goals_for, goals_against = random.choice(pool)
        return goals_for, goals_against

    # loss
    confidence = loss
    pool = _DECISIVE_SCORELINES if confidence >= _DECISIVE_THRESHOLD else _NARROW_SCORELINES
    goals_against, goals_for = random.choice(pool)
    return goals_for, goals_against


def _match_tension(win: float, draw: float, loss: float, score_home: int, score_away: int) -> float:
    """0 = partido resuelto de antemano, 1 = maxima igualdad y emocion.
    Combina lo reñidas que estaban las probabilidades con lo ajustado del
    marcador final: una goleada nunca genera tension alta aunque el modelo
    dudara antes del partido, y viceversa."""
    probs = sorted([win, draw, loss], reverse=True)
    prob_margin = probs[0] - probs[1]
    prob_tension = max(0.0, 1 - prob_margin * 2)

    goal_diff = abs(score_home - score_away)
    if goal_diff <= 1:
        score_tension = 1.0
    elif goal_diff == 2:
        score_tension = 0.4
    else:
        score_tension = 0.1

    return (prob_tension + score_tension) / 2


def _is_close_match(win: float, draw: float, loss: float) -> bool:
    probs = sorted([win, draw, loss], reverse=True)
    return (probs[0] - probs[1]) < _RED_CARD_PROB_MARGIN


def _scorer_weight(player: dict) -> float:
    """Mas peso a delanteros y al mediapunta (slot CAM); un rating 0 no deja
    a un jugador con peso nulo (jugadores sin datos siguen pudiendo marcar)."""
    rating = max(player.get("rating") or 0.0, 0.5)
    position = player.get("position")
    slot_position = player.get("slot_position")

    if position == "forward":
        multiplier = 3.0
    elif slot_position == "CAM":
        multiplier = 2.5
    elif position == "midfielder":
        multiplier = 1.0
    elif position == "defender":
        multiplier = 0.3
    else:  # goalkeeper
        multiplier = 0.05

    return rating * multiplier


def _pick_home_scorer(team: list[dict]) -> str:
    if not team:
        return "Jugador"
    weights = [_scorer_weight(player) for player in team]
    return random.choices(team, weights=weights, k=1)[0]["name"]


def _pick_away_scorer() -> str:
    return random.choice(_GENERIC_RIVAL_SCORERS)


def _pick_penalty_taker(team: list[dict]) -> dict | None:
    """El delantero con mejor rating o el centrocampista con mejor rating,
    el que tenga el rating mas alto de los dos."""
    forwards = [p for p in team if p.get("position") == "forward"]
    midfielders = [p for p in team if p.get("position") == "midfielder"]
    best_forward = max(forwards, key=lambda p: p.get("rating") or 0.0, default=None)
    best_midfielder = max(midfielders, key=lambda p: p.get("rating") or 0.0, default=None)
    candidates = [p for p in (best_forward, best_midfielder) if p is not None]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.get("rating") or 0.0)


def _pick_yellow_recipient(team: list[dict]) -> str:
    """Solo DF/MF reciben amarilla salvo un <5% de excepcion para GK/FW."""
    if random.random() < 0.95:
        pool = [p for p in team if p.get("position") in ("defender", "midfielder")]
    else:
        pool = [p for p in team if p.get("position") in ("goalkeeper", "forward")]
    if not pool:
        pool = team
    return random.choice(pool)["name"] if pool else "Jugador"


def _pick_red_recipient(team: list[dict]) -> str | None:
    """Solo defensas o centrocampistas centrales (slot CB/CDM/CM/CAM);
    nunca extremos ni delanteros. None si el equipo no tiene ningun
    jugador asi (formacion sin ningun DF/MF en slot central)."""
    pool = [
        p
        for p in team
        if p.get("position") in ("defender", "midfielder") and p.get("slot_position") in _CENTRAL_SLOTS
    ]
    if not pool:
        return None
    return random.choice(pool)["name"]


def _draw_unique_minute(
    used_minutes: set[int], lo: int, hi: int, second_half_bias: float = 0.0
) -> int | None:
    """Minuto entre lo/hi (inclusive) que no colisione con uno ya usado.
    second_half_bias > 0 favorece sortear en la segunda mitad del rango
    disponible. None si no se encuentra hueco en un numero razonable de
    intentos (el rango de minutos siempre sobra frente al numero de
    eventos que se generan, asi que en la practica no deberia pasar)."""
    if lo > hi:
        return None

    midpoint = (lo + hi) // 2
    for _ in range(200):
        if second_half_bias > 0 and random.random() < second_half_bias and midpoint + 1 <= hi:
            minute = random.randint(midpoint + 1, hi)
        else:
            minute = random.randint(lo, hi)
        if minute not in used_minutes:
            used_minutes.add(minute)
            return minute
    return None


def _decide_yellow_count(tension: float) -> int:
    """Goleadas (tension baja) casi nunca tienen tarjetas; partidos muy
    igualados pueden llegar hasta el maximo de 4."""
    if tension < 0.25:
        return random.choices([0, 1], weights=[90, 10])[0]
    if tension < 0.55:
        return random.choices([0, 1, 2], weights=[45, 35, 20])[0]
    if tension < 0.8:
        return random.choices([0, 1, 2, 3], weights=[20, 30, 30, 20])[0]
    return random.choices([0, 1, 2, 3, 4], weights=[10, 20, 25, 25, 20])[0]


def _closing_text(
    result: str, score_home: int, score_away: int, win: float, draw: float, loss: float, chemistry: dict | None
) -> str:
    if result == "win":
        confidence = win
        if confidence >= _DECISIVE_THRESHOLD:
            templates = [
                f"Victoria clara y merecida, {score_home}-{score_away}: tu equipo dominó de principio a fin.",
                f"Otro triunfo contundente, {score_home}-{score_away}. El favorito cumplió sobre el campo.",
            ]
        else:
            templates = [
                f"Victoria de carácter, {score_home}-{score_away}, ante un rival que lo puso difícil.",
                f"Se sufre pero se gana: {score_home}-{score_away} en un partido muy igualado.",
            ]
    elif result == "draw":
        templates = [
            f"Reparto de puntos, {score_home}-{score_away}. Ninguno logró hacer valer su favoritismo.",
            f"Empate justo, {score_home}-{score_away}, en un partido de ida y vuelta.",
        ]
    else:
        confidence = loss
        if confidence >= _DECISIVE_THRESHOLD:
            templates = [
                f"Derrota dura, {score_home}-{score_away}, ante un rival claramente superior.",
                f"Se veía venir: {score_home}-{score_away} y una eliminación sin demasiadas dudas.",
            ]
        else:
            templates = [
                f"Derrota dolorosa por la mínima diferencia, {score_home}-{score_away}, en un partido que se pudo ganar.",
                f"Se escapa en el tramo final: {score_home}-{score_away} pese a plantar cara.",
            ]

    text = random.choice(templates)
    if chemistry and chemistry.get("total_bonus", 0) > 0:
        bonus_pct = round(chemistry["total_bonus"] * 100)
        text += f" La química del equipo (+{bonus_pct}%) se notó sobre el césped."
    return text


def generate_match_events(match_data: dict) -> dict:
    """match_data: {result, win, draw, loss, explanation, chemistry, team}.

    "team" es la lista de jugadores del draft (con "name", "position",
    "rating" y "slot_position") tal como la devuelve get_draft_team(); el
    rival no tiene jugadores reales, se usan nombres genericos acordes a
    su posicion.
    """
    result = match_data["result"]
    win = match_data.get("win", 0.0)
    draw = match_data.get("draw", 0.0)
    loss = match_data.get("loss", 0.0)
    team = match_data.get("team", [])
    chemistry = match_data.get("chemistry")

    score_home, score_away = _pick_score(result, win, draw, loss)

    used_minutes: set[int] = set()
    home_goal_range = (MIN_EVENT_MINUTE, MAX_EVENT_MINUTE)
    away_goal_range = (MIN_EVENT_MINUTE, MAX_EVENT_MINUTE)
    events: list[dict] = []

    # --- roja: se decide antes que los goles porque, si ocurre, el equipo
    # sancionado no puede marcar despues de ese minuto ---
    if _is_close_match(win, draw, loss) and random.random() < _RED_CARD_CHANCE:
        red_team = random.choice(["home", "away"])
        recipient = (
            _pick_red_recipient(team) if red_team == "home" else random.choice(_GENERIC_RIVAL_RED_CENTRAL)
        )
        if recipient is not None:
            red_minute = _draw_unique_minute(used_minutes, SECOND_HALF_START, MAX_EVENT_MINUTE)
            if red_minute is not None:
                events.append(
                    {"minute": red_minute, "type": "red_card", "team": red_team, "player_name": recipient}
                )
                if red_team == "home":
                    home_goal_range = (MIN_EVENT_MINUTE, red_minute - 1)
                else:
                    away_goal_range = (MIN_EVENT_MINUTE, red_minute - 1)

    # --- goles: como mucho un penalti por equipo, marcado siempre por el
    # mismo lanzador designado ---
    home_penalty_taker = _pick_penalty_taker(team)
    away_penalty_taker_name = random.choice(_GENERIC_RIVAL_PENALTY_TAKERS)

    for team_side, score, goal_range, penalty_taker_name in (
        ("home", score_home, home_goal_range, home_penalty_taker["name"] if home_penalty_taker else None),
        ("away", score_away, away_goal_range, away_penalty_taker_name),
    ):
        minutes = sorted(
            minute
            for minute in (
                _draw_unique_minute(used_minutes, *goal_range) for _ in range(score)
            )
            if minute is not None
        )
        penalty_minute = None
        if minutes and penalty_taker_name and random.random() < _PENALTY_GOAL_CHANCE:
            penalty_minute = random.choice(minutes)

        for minute in minutes:
            if minute == penalty_minute:
                events.append(
                    {"minute": minute, "type": "penalty", "team": team_side, "player_name": penalty_taker_name}
                )
            else:
                scorer = _pick_home_scorer(team) if team_side == "home" else _pick_away_scorer()
                events.append({"minute": minute, "type": "goal", "team": team_side, "player_name": scorer})

    # --- amarillas: frecuencia segun lo reñido del partido ---
    tension = _match_tension(win, draw, loss, score_home, score_away)
    for _ in range(min(_decide_yellow_count(tension), MAX_YELLOW_CARDS)):
        minute = _draw_unique_minute(used_minutes, MIN_CARD_MINUTE, MAX_EVENT_MINUTE, second_half_bias=0.72)
        if minute is None:
            break
        team_side = random.choice(["home", "away"])
        recipient = (
            _pick_yellow_recipient(team)
            if team_side == "home"
            else random.choice(_GENERIC_RIVAL_YELLOW if random.random() < 0.95 else _GENERIC_RIVAL_YELLOW_RARE)
        )
        events.append({"minute": minute, "type": "yellow_card", "team": team_side, "player_name": recipient})

    # --- penalti fallado: solo si a ese equipo el resultado final no le
    # fue favorable (no tendria sentido lamentar un fallo en una goleada
    # a favor) ---
    if home_penalty_taker and result in ("loss", "draw") and random.random() < _PENALTY_MISS_CHANCE:
        minute = _draw_unique_minute(used_minutes, MIN_EVENT_MINUTE, MAX_EVENT_MINUTE)
        if minute is not None:
            events.append(
                {
                    "minute": minute,
                    "type": "penalty_miss",
                    "team": "home",
                    "player_name": home_penalty_taker["name"],
                }
            )

    if result in ("win", "draw") and random.random() < _PENALTY_MISS_CHANCE:
        minute = _draw_unique_minute(used_minutes, MIN_EVENT_MINUTE, MAX_EVENT_MINUTE)
        if minute is not None:
            events.append(
                {
                    "minute": minute,
                    "type": "penalty_miss",
                    "team": "away",
                    "player_name": away_penalty_taker_name,
                }
            )

    events.sort(key=lambda event: event["minute"])

    return {
        "score_home": score_home,
        "score_away": score_away,
        "events": events,
        "closing_text": _closing_text(result, score_home, score_away, win, draw, loss, chemistry),
    }
