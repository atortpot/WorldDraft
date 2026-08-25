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
  explanation: MatchExplanationItem[]
}
