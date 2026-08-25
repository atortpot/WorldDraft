import type { SimulationResult } from '../api/types'

const RESULT_LABEL: Record<string, string> = {
  win: 'Victoria',
  draw: 'Empate',
  loss: 'Derrota',
}

const RESULT_COLOR: Record<string, string> = {
  win: 'text-emerald-400',
  draw: 'text-amber-400',
  loss: 'text-red-400',
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

interface Props {
  result: SimulationResult
  onNext: () => void
}

export function MatchResultPanel({ result, onNext }: Props) {
  const outcomeLabel = result.advanced ? 'Avanzas de ronda' : 'Quedas eliminado'
  const outcomeColor = result.advanced ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Rival: {result.opponent.country} · Mundial {result.opponent.tournament_year}
        </p>
        <h2 className={`text-4xl font-bold ${RESULT_COLOR[result.result]}`}>
          {RESULT_LABEL[result.result] ?? result.result}
        </h2>
        {result.penalties?.took_place && (
          <p className="text-sm text-slate-400">
            Empate en el tiempo reglamentario, resuelto en la tanda de penaltis.
          </p>
        )}
        <p className={`text-sm font-semibold ${outcomeColor}`}>{outcomeLabel}</p>
      </header>

      <section className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Victoria</p>
          <p className="text-2xl font-bold text-emerald-400">{formatPercent(result.win)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Empate</p>
          <p className="text-2xl font-bold text-amber-400">{formatPercent(result.draw)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Derrota</p>
          <p className="text-2xl font-bold text-red-400">{formatPercent(result.loss)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-slate-200">Que inclino el partido</h3>
        {result.explanation.length === 0 ? (
          <p className="text-sm text-slate-500">
            El modelo actual no permite desglosar esta prediccion en factores individuales.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.explanation.map((item) => (
              <li
                key={item.feature}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <span className="text-sm text-slate-300">{item.label}</span>
                <span
                  className={`text-sm font-medium ${item.favors === 'team_a' ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {item.favors === 'team_a' ? 'a tu favor' : 'a favor del rival'} ·{' '}
                  {Math.abs(item.weight).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          {result.tournament_finished ? 'Ver resultado final' : 'Siguiente partido'}
        </button>
      </div>
    </div>
  )
}
