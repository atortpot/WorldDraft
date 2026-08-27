"""Cruce de nombres de jugadores en 3 niveles, compartido por
app/players/importer.py y scripts/update_ratings_2018_2022_2026.py.

El cruce SIEMPRE exige coincidencia de (nombre, año, país) -- el país debe
venir ya resuelto a un nombre canonico (ver app/model/fifa_data.py) antes
de llegar aqui, porque las fuentes nombran paises de forma distinta entre
si. Sin el pais, dos jugadores homonimos de paises distintos (p.ej. un
"Emiliano Martinez" argentino y otro uruguayo) pueden cruzarse mal.

Niveles:
1. Coincidencia exacta de nombre normalizado, mismo año y pais.
2. Apellido: solo si identifica de forma unica a un jugador, tanto en el
   lado que se cruza (misma convocatoria/año/pais) como en las entradas de
   una sola palabra del indice fuente (p.ej. "VALDERRAMA").
3. Fuzzy matching (thefuzz, token_set_ratio) contra los nombres del indice
   fuente para ese año+pais, con umbral >= FUZZY_THRESHOLD (85). Dos
   confirmaciones extra bajan el umbral, siempre sobre el pool ya
   restringido a ese pais:
   - posicion tambien coincide -> FUZZY_THRESHOLD_WITH_POSITION (75),
     p.ej. "Nico Paz" vs "Nicolas Paz" (84).
   - posicion Y apellido coinciden exactamente -> FUZZY_THRESHOLD_WITH_SURNAME
     (60), para diminutivo/nombre legal con mucho ruido de nombres de pila
     (p.ej. "Manu Kone" vs "Emmanuel Boris Kone", 64). Este nivel se probo
     contra el propio dataset: con pais+posicion+apellido exacto el riesgo
     de falso positivo baja de 731 a 48 pares candidatos en todo squads.csv
     (p.ej. dos jugadores reales distintos "Arouna Kone"/"Bakari Kone",
     Costa de Marfil 2006, mismo apellido y posicion) -- no es cero, es un
     riesgo residual aceptado a cambio de resolver los casos de diminutivo.
   Se descarta si mas de un candidato distinto supera el umbral aplicable,
   salvo que se pueda desempatar de forma segura por inicial suelta
   (p.ej. "BAGGIO D." vs "BAGGIO R.") o por posicion.

No incluye un fallback fuzzy de "solo apellido" (p.ej. para reparar
apellidos con un caracter corrupto): se probo y un falso positivo real
("FERNANDES" vs "FERNANDEZ", dos apellidos distintos del mismo año/pais)
puntua mas alto que el caso legitimo que se queria arreglar, asi que no
hay un umbral que separe ambos casos con seguridad.
"""

import re
import unicodedata
from collections import Counter, defaultdict

from thefuzz import fuzz, process

FUZZY_THRESHOLD = 85
FUZZY_THRESHOLD_WITH_POSITION = 75
FUZZY_THRESHOLD_WITH_SURNAME = 60
FUZZY_CANDIDATE_LIMIT = 5

# Nombres tipo "MARQUINHOSMarcos" o "SEMEDONélson Nelson": el apellido va
# pegado en mayusculas justo antes del/los nombres de pila, sin espacio.
# Visto en player_stats.csv para varias federaciones lusofonas (Brasil,
# Portugal, Cabo Verde) y tambien Qatar.
_CONCATENATED_NAME_RE = re.compile(r"^([A-ZÀ-Ý]{2,})([A-ZÀ-Ý][a-zà-ÿ].*)$")


def normalize_name(name: str) -> str:
    """Sin acentos, en mayusculas, espacios colapsados y SIN guiones (no se
    reemplazan por espacio, se eliminan): los nombres coreanos romanizados
    vienen con guion en una fuente y pegados en otra (p.ej. squads.csv trae
    "Lee Tae-seok", player_stats.csv trae "Taeseok Lee"); quitar el guion
    fusiona "Tae-seok" en "Taeseok" y deja ambas fuentes con el mismo
    conjunto de tokens, recuperable por fuzzy matching (token_set_ratio) aun
    con el orden de nombre/apellido invertido entre fuentes."""
    without_accents = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    without_hyphens = without_accents.replace("-", "")
    return " ".join(without_hyphens.upper().split())


def split_concatenated_name(raw_name: str) -> str | None:
    """'MARQUINHOSMarcos' -> 'Marcos Marquinhos'. None si no matchea el patron.

    Reconstruye como "nombres apellido" (el orden que usan las demas
    fuentes) para que el resto del pipeline de cruce lo trate igual que
    cualquier otro nombre. Puede dejar un nombre de pila duplicado (p.ej.
    "Gabriel Gabriel Martinelli") -- no afecta al cruce porque el fuzzy
    tokeniza y trata los tokens como conjunto.
    """
    match = _CONCATENATED_NAME_RE.match(raw_name.strip())
    if not match:
        return None
    surname, rest = match.groups()
    return f"{rest.strip()} {surname.title()}"


def _initial_matches(query_first_token: str, candidate_tokens: list[str]) -> bool:
    for token in candidate_tokens:
        token = token.rstrip(".")
        if len(token) == 1 and query_first_token.startswith(token):
            return True
    return False


class NameMatcher:
    """Indice de (nombre normalizado, año, pais canonico) -> valor.

    `positions`, si se pasa, es un indice paralelo con la misma clave que
    `index`, usado solo para relajar el umbral fuzzy y para desempatar
    candidatos ambiguos -- nunca sustituye el requisito de pais.
    """

    def __init__(
        self,
        index: dict[tuple[str, int, str], object],
        positions: dict[tuple[str, int, str], str] | None = None,
    ):
        self._index = index
        self._positions = positions or {}
        self._surname_index = {key: value for key, value in index.items() if " " not in key[0]}

        self._names_by_year_country: dict[tuple[int, str], list[str]] = defaultdict(list)
        for name, year, country in index:
            self._names_by_year_country[(year, country)].append(name)

        self._surname_counts: dict[tuple[int, str], Counter] = defaultdict(Counter)
        self.stats: Counter = Counter()

    def register_query_name(self, raw_name: str, year: int, country: str) -> None:
        """Registra un nombre del lado que se va a cruzar, para saber si un
        apellido lo identifica de forma unica en esa convocatoria/año/pais."""
        normalized = normalize_name(raw_name)
        parts = normalized.split()
        surname = parts[-1] if parts else normalized
        self._surname_counts[(year, country)][surname] += 1

    def match(self, raw_name: str, year: int, country: str, position: str | None = None):
        normalized = normalize_name(raw_name)

        value = self._index.get((normalized, year, country))
        if value is not None:
            self.stats["exact"] += 1
            return value

        parts = normalized.split()
        surname = parts[-1] if parts else normalized
        if self._surname_counts[(year, country)][surname] == 1:
            value = self._surname_index.get((surname, year, country))
            if value is not None:
                self.stats["surname"] += 1
                return value

        candidates = self._names_by_year_country.get((year, country))
        if candidates:
            scored = process.extract(
                normalized, candidates, scorer=fuzz.token_set_ratio, limit=FUZZY_CANDIDATE_LIMIT
            )

            def _clears_threshold(name: str, score: int) -> bool:
                position_matches = position is not None and self._positions.get((name, year, country)) == position
                if position_matches:
                    candidate_surname = name.split()[-1] if name.split() else name
                    if candidate_surname == surname:
                        return score >= FUZZY_THRESHOLD_WITH_SURNAME
                    return score >= FUZZY_THRESHOLD_WITH_POSITION
                return score >= FUZZY_THRESHOLD

            above_threshold = {name for name, score in scored if _clears_threshold(name, score)}

            chosen = None
            if len(above_threshold) == 1:
                chosen = next(iter(above_threshold))
            elif len(above_threshold) > 1:
                query_first = parts[0] if parts else normalized
                tied = [name for name in above_threshold if _initial_matches(query_first, name.split())]
                if len(tied) == 1:
                    chosen = tied[0]
                elif position is not None:
                    tied_by_position = [
                        name
                        for name in above_threshold
                        if self._positions.get((name, year, country)) == position
                    ]
                    if len(tied_by_position) == 1:
                        chosen = tied_by_position[0]

            if chosen is not None:
                value = self._index.get((chosen, year, country))
                if value is not None:
                    self.stats["fuzzy"] += 1
                    return value

        self.stats["unmatched"] += 1
        return None
