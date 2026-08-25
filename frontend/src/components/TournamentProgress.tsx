import type { DraftRoundCode, SimulationResult, TournamentRoundCode } from '../api/types'

interface RoundStep {
  code: TournamentRoundCode
  label: string
}

// Debe coincidir con ROUND_ORDER de app/game/draft_service.py.
const ROUNDS: RoundStep[] = [
  { code: 'group_1', label: 'Grupo 1' },
  { code: 'group_2', label: 'Grupo 2' },
  { code: 'group_3', label: 'Grupo 3' },
  { code: 'round_of_16', label: 'Octavos' },
  { code: 'quarter_final', label: 'Cuartos' },
  { code: 'semi_final', label: 'Semifinal' },
  { code: 'final', label: 'Final' },
]

interface Props {
  currentRound: DraftRoundCode
  matchHistory: SimulationResult[]
}

function outcomeStyle(result: SimulationResult): { icon: string; className: string } {
  if (!result.advanced) return { icon: '✕', className: 'bg-red-500 text-white' }
  if (result.result === 'draw') return { icon: '⚽', className: 'bg-amber-500 text-slate-950' }
  return { icon: '✓', className: 'bg-emerald-500 text-slate-950' }
}

export function TournamentProgress({ currentRound, matchHistory }: Props) {
  const resultByRound = new Map(matchHistory.map((result) => [result.round, result]))

  return (
    <ol className="flex flex-wrap items-center justify-center gap-2">
      {ROUNDS.map((round, index) => {
        const played = resultByRound.get(round.code)
        const isCurrent = round.code === currentRound

        let circleClass = 'bg-slate-800 text-slate-400 border border-slate-700'
        let content: string = String(index + 1)
        if (played) {
          const style = outcomeStyle(played)
          circleClass = style.className
          content = style.icon
        } else if (isCurrent) {
          circleClass = 'bg-slate-100 text-slate-950 ring-2 ring-emerald-500'
        }

        return (
          <li key={round.code} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${circleClass}`}
              >
                {content}
              </span>
              <span
                className={`text-[11px] ${isCurrent ? 'font-semibold text-slate-100' : 'text-slate-500'}`}
              >
                {round.label}
              </span>
            </div>
            {index < ROUNDS.length - 1 && <span className="h-px w-6 bg-slate-700" />}
          </li>
        )
      })}
    </ol>
  )
}
