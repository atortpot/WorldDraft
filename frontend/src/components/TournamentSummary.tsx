import { GroupStandingsTable } from './GroupStandingsTable'
import { PenaltyShootoutSummary } from './PenaltyShootout'
import { BallIcon, CheckIcon, CrossIcon, TrophyIcon } from '../lib/icons'
import type { GroupMatchSummary, KnockoutMatchSummary, Scorer, TournamentHistory } from '../api/types'

const GROUP_ROUND_LABELS: Record<string, string> = {
  group_1: 'Grupo · Partido 1',
  group_2: 'Grupo · Partido 2',
  group_3: 'Grupo · Partido 3',
}

const KNOCKOUT_ROUND_LABELS: Record<string, string> = {
  round_of_16: 'Octavos de final',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinal',
  final: 'Final',
}

// Coincide con los textos ya usados en EliminatedPage para la misma ronda.
const ELIMINATED_LABELS: Record<string, string> = {
  group_stage: 'la fase de grupos',
  round_of_16: 'octavos de final',
  quarter_final: 'cuartos de final',
  semi_final: 'semifinales',
  final: 'la final',
}

const RESULT_COLOR: Record<string, string> = {
  win: 'text-emerald-400',
  draw: 'text-amber-400',
  loss: 'text-red-400',
}

const RESULT_LABEL: Record<string, string> = {
  win: 'Victoria',
  draw: 'Empate',
  loss: 'Derrota',
}

function formatScorers(scorers: Scorer[]): string {
  if (scorers.length === 0) return 'Sin goleadores'
  return scorers.map((s) => `${s.player_name} ${s.minute}'${s.type === 'penalty' ? ' (pen)' : ''}`).join(', ')
}

function GroupMatchRow({ match }: { match: GroupMatchSummary }) {
  return (
    <li className="glass-card flex flex-col gap-2 rounded-xl px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
          {GROUP_ROUND_LABELS[match.round] ?? match.round}
        </span>
        <span className={`text-sm font-bold ${RESULT_COLOR[match.result]}`}>{RESULT_LABEL[match.result]}</span>
      </div>
      <p className="font-semibold text-slate-100">
        Tu equipo {match.goals_for}-{match.goals_against} {match.opponent.country}{' '}
        {match.opponent.tournament_year}
      </p>
      <div className="flex flex-col gap-1 text-xs text-slate-400">
        <p>
          <span className="text-slate-500">Tuyos: </span>
          {formatScorers(match.own_scorers)}
        </p>
        <p>
          <span className="text-slate-500">Rival: </span>
          {formatScorers(match.opponent_scorers)}
        </p>
      </div>
    </li>
  )
}

function KnockoutMatchRow({ match }: { match: KnockoutMatchSummary }) {
  return (
    <li className="glass-card flex flex-col gap-2 rounded-xl px-4 py-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
          {KNOCKOUT_ROUND_LABELS[match.round] ?? match.round}
        </span>
        <span
          className={`flex items-center gap-1.5 text-sm font-bold ${
            match.advanced ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {match.advanced ? <CheckIcon className="h-4 w-4" /> : <CrossIcon className="h-4 w-4" />}
          {match.advanced ? 'Avanzaste' : 'Eliminado'}
        </span>
      </div>
      <p className="font-semibold text-slate-100">
        Tu equipo {match.goals_for}-{match.goals_against} {match.opponent.country}{' '}
        {match.opponent.tournament_year}
      </p>
      {match.went_to_extra_time && (
        <p className="text-xs font-medium text-slate-400">
          Prorroga: {match.extra_time_goals_for}-{match.extra_time_goals_against}
        </p>
      )}
      {match.penalties?.took_place && <PenaltyShootoutSummary penalties={match.penalties} />}
      <div className="flex flex-col gap-1 text-xs text-slate-400">
        <p>
          <span className="text-slate-500">Tuyos: </span>
          {formatScorers(match.own_scorers)}
        </p>
        <p>
          <span className="text-slate-500">Rival: </span>
          {formatScorers(match.opponent_scorers)}
        </p>
      </div>
    </li>
  )
}

interface Props {
  history: TournamentHistory
  onPlayAgain: () => void
}

// Resumen final del torneo completo: tabla + 3 partidos de grupos con
// goleadores, bracket simple de las eliminatorias jugadas, y el resultado
// global. Puramente presentacional -- la carga de datos vive en
// TournamentSummaryPage.
export function TournamentSummary({ history, onPlayAgain }: Props) {
  const outcomeText = history.is_champion
    ? 'Campeon del torneo'
    : `Eliminado en ${ELIMINATED_LABELS[history.eliminated_round ?? ''] ?? history.eliminated_round}`

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            history.is_champion
              ? 'bg-gradient-to-b from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30'
              : 'border border-red-500/30 bg-gradient-to-b from-slate-800 to-slate-950'
          }`}
        >
          {history.is_champion ? (
            <TrophyIcon className="h-8 w-8 text-amber-950" />
          ) : (
            <BallIcon className="h-8 w-8 text-red-400" />
          )}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">Resumen del torneo</h1>
        <p className={`text-lg font-bold ${history.is_champion ? 'text-amber-400' : 'text-red-400'}`}>
          {outcomeText}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-slate-100">Fase de grupos</h2>
        <GroupStandingsTable table={history.group_table} />
        <ul className="flex flex-col gap-2">
          {history.group_matches.map((match) => (
            <GroupMatchRow key={match.round} match={match} />
          ))}
        </ul>
      </section>

      {history.knockout_matches.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-slate-100">Fase eliminatoria</h2>
          <ul className="flex flex-col gap-2">
            {history.knockout_matches.map((match) => (
              <KnockoutMatchRow key={match.round} match={match} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onPlayAgain}
          className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
        >
          Jugar de nuevo
        </button>
      </div>
    </div>
  )
}
