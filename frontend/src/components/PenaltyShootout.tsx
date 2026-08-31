import { BallIcon, PenaltyMissIcon } from '../lib/icons'
import type { Penalties, PenaltyKick } from '../api/types'

// Compartido entre TournamentSummary (resumen final) y MatchAnimationScreen
// (recap estatico tras la fase animada de la tanda, o si el usuario salto
// la animacion): un lanzador por linea, con icono de gol o fallo.
export function PenaltyKicksList({ kicks, team }: { kicks: PenaltyKick[]; team: 'home' | 'away' }) {
  const teamKicks = kicks.filter((kick) => kick.team === team)
  if (teamKicks.length === 0) return <span>-</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {teamKicks.map((kick, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {kick.scored ? (
            <BallIcon className="h-3 w-3 shrink-0 text-emerald-400" />
          ) : (
            <PenaltyMissIcon className="h-3 w-3 shrink-0 text-red-400" />
          )}
          <span className={kick.scored ? 'text-slate-300' : 'text-slate-500 line-through'}>
            {kick.player_name}
          </span>
        </span>
      ))}
    </span>
  )
}

export function PenaltyShootoutSummary({ penalties }: { penalties: Penalties }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-900/50 p-3">
      <p className="text-sm font-bold text-amber-400">
        Penaltis: {penalties.home_goals}-{penalties.away_goals}{' '}
        <span className="font-normal text-amber-400/80">
          ({penalties.won_by_team ? 'la ganaste' : 'la perdiste'})
        </span>
      </p>
      <div className="flex flex-col gap-1.5 text-xs text-slate-400">
        <p>
          <span className="text-slate-500">Tuyos: </span>
          <PenaltyKicksList kicks={penalties.kicks} team="home" />
        </p>
        <p>
          <span className="text-slate-500">Rival: </span>
          <PenaltyKicksList kicks={penalties.kicks} team="away" />
        </p>
      </div>
    </div>
  )
}
