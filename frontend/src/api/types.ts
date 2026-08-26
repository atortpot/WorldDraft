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

export interface Penalties {
  took_place: boolean
  won_by_team: boolean
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
}
