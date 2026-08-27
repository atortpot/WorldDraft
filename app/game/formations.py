"""Layout de slots de cada formacion y reglas de compatibilidad con la
posicion natural del jugador.

Cada formacion es una lista ORDENADA de 11 codigos de slot; el indice dentro
de esa lista (0-10) es lo que identifica un slot concreto en DraftPick.slot_index
(dos slots del mismo tipo, p.ej. los dos CB de un 4-3-3, son entradas
distintas de la lista con distinto indice).
"""

from app.db.models import Formation, PlayerPosition

FORMATIONS: dict[Formation, list[str]] = {
    Formation.F_4_3_3: ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
    Formation.F_4_4_2: ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
    Formation.F_4_3_2_1: ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "CAM", "ST"],
    Formation.F_3_5_2: ["GK", "CB", "CB", "CB", "LM", "CDM", "CM", "CDM", "RM", "ST", "ST"],
    Formation.F_4_2_3_1: ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LM", "CAM", "RM", "ST"],
    Formation.F_4_5_1: ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "CM", "RM", "ST"],
    Formation.F_5_3_2: ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
    Formation.F_5_4_1: ["GK", "LWB", "CB", "CB", "CB", "RWB", "LM", "CM", "CM", "RM", "ST"],
    Formation.F_3_4_3: ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
    Formation.F_4_1_4_1: ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"],
    Formation.F_4_4_2_DIAMOND: ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST", "ST"],
    Formation.F_3_4_2_1: ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "CAM", "CAM", "ST"],
}

for _formation, _slots in FORMATIONS.items():
    assert len(_slots) == 11, f"{_formation} tiene {len(_slots)} slots, deberian ser 11"

# Codigo de slot -> posiciones naturales de Player compatibles. CAM es el
# unico compartido entre dos posiciones naturales (MF y FW). LWB/RWB/WB y
# CDM/DM son alias del mismo rol defensivo/mediocentro: WB y DM no los usa
# ninguna de las 12 formaciones de FORMATIONS, pero se incluyen por si se
# añaden formaciones nuevas que si los usen.
SLOT_COMPATIBILITY: dict[str, set[PlayerPosition]] = {
    "GK": {PlayerPosition.GOALKEEPER},
    "CB": {PlayerPosition.DEFENDER},
    "LB": {PlayerPosition.DEFENDER},
    "RB": {PlayerPosition.DEFENDER},
    "LWB": {PlayerPosition.DEFENDER},
    "RWB": {PlayerPosition.DEFENDER},
    "WB": {PlayerPosition.DEFENDER},
    "CDM": {PlayerPosition.MIDFIELDER},
    "DM": {PlayerPosition.MIDFIELDER},
    "CM": {PlayerPosition.MIDFIELDER},
    "LM": {PlayerPosition.MIDFIELDER},
    "RM": {PlayerPosition.MIDFIELDER},
    "CAM": {PlayerPosition.MIDFIELDER, PlayerPosition.FORWARD},
    "ST": {PlayerPosition.FORWARD},
    "LW": {PlayerPosition.FORWARD},
    "RW": {PlayerPosition.FORWARD},
}


def slots_for(formation: Formation) -> list[str]:
    return FORMATIONS[formation]


def is_slot_compatible(slot_position: str, player_position: PlayerPosition) -> bool:
    return player_position in SLOT_COMPATIBILITY.get(slot_position, set())
