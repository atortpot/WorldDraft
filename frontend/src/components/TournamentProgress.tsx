import { BallIcon, CheckIcon, CrossIcon } from '../lib/icons'
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

function outcomeStyle(result: SimulationResult): { Icon: typeof CheckIcon; className: string } {
  if (!result.advanced) return { Icon: CrossIcon, className: 'bg-red-500 text-white shadow-red-900/50' }
  if (result.result === 'draw') return { Icon: BallIcon, className: 'bg-amber-500 text-slate-950 shadow-amber-900/50' }
  return { Icon: CheckIcon, className: 'bg-emerald-500 text-slate-950 shadow-emerald-900/50' }
}

const GROUP_STAGE_ROUNDS = ROUNDS.slice(0, 3)
const KNOCKOUT_ROUNDS = ROUNDS.slice(3)

export function TournamentProgress({ currentRound, matchHistory }: Props) {
  const resultByRound = new Map(matchHistory.map((result) => [result.round, result]))

  function renderStep(round: RoundStep, index: number, isLast: boolean) {
    const played = resultByRound.get(round.code)
    const isCurrent = round.code === currentRound
    const style = played ? outcomeStyle(played) : null

    return (
      <li key={round.code} className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-lg transition-all ${
              style
                ? style.className
                : isCurrent
                  ? 'bg-slate-100 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-900/40'
                  : 'border border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {style ? <style.Icon className="h-4 w-4" /> : index + 1}
          </span>
          <span className={`text-[11px] font-medium ${isCurrent ? 'text-slate-100' : 'text-slate-500'}`}>
            {round.label}
          </span>
        </div>
        {!isLast && <span className="h-px w-6 bg-slate-700" />}
      </li>
    )
  }

  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Fase de grupos · 3 partidos
        </span>
        <ol className="flex items-center gap-2">
          {GROUP_STAGE_ROUNDS.map((round, index) =>
            renderStep(round, index, index === GROUP_STAGE_ROUNDS.length - 1),
          )}
        </ol>
      </div>

      <span className="mt-4 hidden h-9 w-px bg-slate-700 sm:block" />

      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Eliminatorias
        </span>
        <ol className="flex items-center gap-2">
          {KNOCKOUT_ROUNDS.map((round, index) =>
            renderStep(round, GROUP_STAGE_ROUNDS.length + index, index === KNOCKOUT_ROUNDS.length - 1),
          )}
        </ol>
      </div>
    </div>
  )
}
