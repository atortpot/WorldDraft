export type PositionAbbreviation = 'GK' | 'DF' | 'MF' | 'FW'

export interface Candidate {
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

export interface TeamMember {
  pick_id: number
  position_slot: string
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
}
