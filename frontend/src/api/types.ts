export interface MeResponse {
  id: number
  email: string
  created_at: string
}

export type PositionAbbreviation = 'GK' | 'DF' | 'MF' | 'FW'

// Codigo de slot dentro de una formacion. Debe coincidir con los codigos
// usados en app/game/formations.py (FORMATIONS / SLOT_COMPATIBILITY).
export type SlotPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'ST'
  | 'LW'
  | 'RW'

// Debe coincidir con los 12 valores de Formation en app/db/models.py.
export type FormationName =
  | '4-3-3'
  | '4-4-2'
  | '4-3-2-1'
  | '3-5-2'
  | '4-2-3-1'
  | '4-5-1'
  | '5-3-2'
  | '5-4-1'
  | '3-4-3'
  | '4-1-4-1'
  | '4-4-2 Diamante'
  | '3-4-2-1'

// Modo de presentacion del draft, puramente de frontend (no se envia al
// backend): en "almanac" el rating de los jugadores se oculta mientras se
// elige, para forzar a decidir de memoria en vez de por el numero.
export type DraftMode = 'classic' | 'almanac'

export interface RollPlayer {
  id: number
  name: string
  country: string
  tournament_year: number
  position: PositionAbbreviation
  goals: number
  assists: number
  minutes_played: number
  rating: number
}

export interface FreeSlot {
  slot_index: number
  position: SlotPosition
}

export interface RollResult {
  country: string
  tournament_year: number
  players: RollPlayer[]
  free_slots: FreeSlot[]
  passes_used: number
  passes_remaining: number
  max_passes: number
}

export interface PassResult {
  passes_used: number
  passes_remaining: number
  max_passes: number
}

export interface TeamMember {
  pick_id: number
  slot_index: number
  slot_position: SlotPosition
  player_id: number
  name: string
  country: string
  tournament_year: number
  position: string
  goals: number
  assists: number
  minutes_played: number
  rating: number
}

export interface MatchExplanationItem {
  feature: string
  label: string
  favors: 'team_a' | 'team_b'
  weight: number
}

export interface TeamStats {
  fifa_points: number
  player_rating_avg: number
  goals_avg: number
}

// Debe coincidir con DraftRound en app/db/models.py.
export type TournamentRoundCode =
  | 'group_1'
  | 'group_2'
  | 'group_3'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'

export type DraftRoundCode = TournamentRoundCode | 'eliminated' | 'champion'

export interface ActiveDraftSession {
  draft_session_id: number
  current_round: TournamentRoundCode
  formation: FormationName
  picks: TeamMember[]
  free_slots: FreeSlot[]
}

export interface PenaltyKick {
  team: 'home' | 'away'
  player_name: string
  scored: boolean
}

export interface Penalties {
  took_place: boolean
  won_by_team: boolean
  home_goals: number
  away_goals: number
  // En el orden en que se lanzaron (casa/usuario siempre tira primero en
  // cada ronda). Ver _simulate_penalty_shootout en el backend.
  kicks: PenaltyKick[]
}

export interface ChemistryNationDetail {
  country: string
  count: number
  bonus: number
}

export interface ChemistryEraDetail {
  era: string
  count: number
  bonus: number
}

export interface Chemistry {
  nation_bonus: number
  era_bonus: number
  total_bonus: number
  chemistry_details: {
    nation: ChemistryNationDetail | null
    era: ChemistryEraDetail | null
  }
}

export type MatchEventType = 'goal' | 'penalty' | 'penalty_miss' | 'yellow_card' | 'red_card'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  team: 'home' | 'away'
  player_name: string
}

export interface MatchNarrative {
  score_home: number
  score_away: number
  events: MatchEvent[]
  closing_text: string
}

// Una fila de la tabla de grupos (el propio equipo o uno de los 3 rivales
// historicos). goal_diff siempre viene calculado por el backend. `qualified`
// es null hasta que termina el group_3 (played=3 partidos del usuario);
// entonces true/false para las 4 filas segun si quedaron en el top 2.
export interface GroupTeamRow {
  is_user: boolean
  country: string | null
  tournament_year: number | null
  played: number
  points: number
  goals_for: number
  goals_against: number
  goal_diff: number
  qualified: boolean | null
}

export interface GroupMatchTeam {
  country: string
  tournament_year: number
}

// Uno de los 3 partidos rival-contra-rival del grupo (nunca involucra al
// usuario), simulados de golpe al terminar el group_3. Solo hay datos
// cuando group_complete es true.
export interface GroupOtherMatch {
  home: GroupMatchTeam
  away: GroupMatchTeam
  home_goals: number
  away_goals: number
}

export interface GroupTable {
  // Siempre 4 filas, ya ordenadas de 1o a 4o (puntos, diferencia de goles,
  // enfrentamiento directo -- ver _make_group_comparator en el backend).
  teams: GroupTeamRow[]
  group_complete: boolean
  other_matches: GroupOtherMatch[]
}

export interface SimulationResult {
  opponent: {
    country: string
    tournament_year: number
  }
  team_stats: TeamStats
  opponent_stats: TeamStats
  win: number
  draw: number
  loss: number
  result: 'win' | 'draw' | 'loss'
  penalties: Penalties | null
  advanced: boolean
  round: TournamentRoundCode
  next_round: DraftRoundCode
  tournament_finished: boolean
  explanation: MatchExplanationItem[]
  chemistry: Chemistry
  narrative: MatchNarrative
  // Solo presente cuando `round` es group_1/2/3; null en eliminatorias.
  group_table: GroupTable | null
  // El partido entre los otros 2 rivales del grupo, simulado a la vez que
  // este (ver _simulate_rival_match en el backend). Solo presente cuando
  // `round` es group_1/2/3; null en eliminatorias.
  parallel_match: GroupOtherMatch | null
  // Si hubo empate en el tiempo reglamentario de una eliminatoria y se jugo
  // la prorroga (91-120). Siempre false en fase de grupos. Cuando es true,
  // narrative.events incluye tambien los eventos de la prorroga (minuto
  // 91-120) y narrative.score_home/away ya es el marcador FINAL (tras la
  // prorroga, no el del 90).
  went_to_extra_time: boolean
}

export interface Scorer {
  player_name: string
  minute: number
  type: 'goal' | 'penalty'
}

// Uno de los partidos de grupos DEL USUARIO (hasta 3, group_1/2/3) con
// goleadores. Los partidos entre los otros rivales del grupo van aparte, en
// TournamentHistory.group_table.other_matches (sin goleadores: esos
// partidos no generan narrativa, solo marcador).
export interface GroupMatchSummary {
  round: TournamentRoundCode
  opponent: GroupMatchTeam
  result: 'win' | 'draw' | 'loss'
  goals_for: number
  goals_against: number
  own_scorers: Scorer[]
  opponent_scorers: Scorer[]
}

export interface KnockoutMatchSummary {
  round: TournamentRoundCode
  opponent: GroupMatchTeam
  // Resultado FINAL (tras prorroga si la hubo); solo sigue siendo "draw"
  // si ademas hizo falta la tanda de penaltis.
  result: 'win' | 'draw' | 'loss'
  // Marcador al final del tiempo reglamentario (minuto 90).
  goals_for: number
  goals_against: number
  went_to_extra_time: boolean
  // Marcador al final de la prorroga (minuto 120); null si no hubo.
  extra_time_goals_for: number | null
  extra_time_goals_against: number | null
  penalties: Penalties | null
  advanced: boolean
  own_scorers: Scorer[]
  opponent_scorers: Scorer[]
}

export interface TournamentHistory {
  formation: FormationName
  is_champion: boolean
  // "group_stage" si no llego a jugar ninguna eliminatoria; si no, la
  // ronda concreta en la que cayo. Null si is_champion.
  eliminated_round: string | null
  group_table: GroupTable
  group_matches: GroupMatchSummary[]
  knockout_matches: KnockoutMatchSummary[]
}
