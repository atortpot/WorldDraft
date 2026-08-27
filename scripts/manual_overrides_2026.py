"""Overrides manuales de nombre para data/player_stats.csv (Mundial 2026):
casos que ningun cruce automatico (exacto, apellido unico, fuzzy) puede
recuperar porque la fuente trae el nombre corrupto (apellido ausente, orden
roto) o demasiado distinto del nombre publico usado en el resto del
proyecto (players.name, via squads.csv/Wikipedia).

Clave: el valor exacto de la columna player_name en player_stats.csv.
Valor: el nombre a usar en su lugar antes de indexar (se le sigue aplicando
normalize_name igual que a cualquier otro nombre, asi que no hace falta que
coincida caracter a caracter con el nombre publico, solo con lo que ya
identifica al jugador via NameMatcher).

Cada entrada documenta como se identifico el jugador porque no es
verificable por un cruce automatico: si player_stats.csv cambia de version
estos podrian dejar de ser validos y habria que revisarlos.
"""

MANUAL_NAME_OVERRIDES_2026: dict[str, str] = {
    # team_id 41 (Portugal): a la fila le falta el apellido por completo.
    # Su nombre legal es "Nuno Alexandre Tavares Mendes"; player_stats.csv
    # solo trae dos de sus nombres de pila ("Alexandre Nuno"), sin
    # "Mendes" -- ningun fuzzy matching puede recuperar un apellido que no
    # esta en el string de origen.
    "Alexandre Nuno": "Nuno Mendes",
    # team_id 9 (Brasil): fila unica en todo el fichero con ese nombre
    # exacto (verificado con awk). Se identifico por eliminacion: cruzando
    # las 26 filas de team_id=9 contra los 26 nombres de la convocatoria de
    # Brasil 2026 en squads.csv por solape de tokens, "Henrique" es la
    # unica fila que no encaja con ningun otro jugador de la lista. Su
    # nombre legal es "Carlos Henrique Venancio Casimiro" (conocido como
    # Casemiro); "Henrique" es uno de sus nombres de pila.
    "Henrique": "Casemiro",
    # team_id 33 (Francia): no es un nombre corrupto ni distinto -- es una
    # ambiguedad real. Theo y Lucas Hernandez son hermanos y comparten 3 de
    # sus 4 nombres de pila/apellidos ("Bernard", "Francois"/"François",
    # "Hernandez") ademas de jugar en la misma posicion (DF), asi que el
    # nombre publico corto de cada uno (p.ej. "Theo Hernandez") tambien
    # matchea por fuzzy contra el nombre completo del OTRO hermano por
    # encima del umbral relajado por posicion (75): "THEO HERNANDEZ" vs
    # "LUCAS FRANCOIS BERNARD HERNANDEZ" puntua 78. El matcher hace bien en
    # negarse a elegir entre los dos automaticamente; aqui se resuelve con
    # certeza porque se sabe de antemano cual es cual.
    "Théo Bernard François Hernandez": "Théo Hernandez",
    "Lucas Francois Bernard Hernandez": "Lucas Hernandez",
}
