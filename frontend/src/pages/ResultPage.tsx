import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft } from '../context/DraftContext'

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

export function ResultPage() {
  const navigate = useNavigate()
  const { result, reset } = useDraft()

  useEffect(() => {
    if (!result) {
      navigate('/')
    }
  }, [result, navigate])

  if (!result) return null

  function handlePlayAgain() {
    reset()
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Rival: {result.opponent.country} · Mundial {result.opponent.tournament_year}
        </p>
        <h1 className={`text-5xl font-bold ${RESULT_COLOR[result.result]}`}>
          {RESULT_LABEL[result.result] ?? result.result}
        </h1>
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
        <h2 className="text-lg font-semibold text-slate-200">Que inclino el partido</h2>
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
          onClick={handlePlayAgain}
          className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Jugar otra vez
        </button>
      </div>
    </div>
  )
}
