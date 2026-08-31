import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useDraft } from '../context/DraftContext'
import { ShieldCrackIcon } from '../lib/icons'

const ROUND_LABELS: Record<string, string> = {
  group_1: 'la fase de grupos',
  group_2: 'la fase de grupos',
  group_3: 'la fase de grupos',
  round_of_16: 'octavos de final',
  quarter_final: 'cuartos de final',
  semi_final: 'semifinales',
  final: 'la final',
}

export function EliminatedPage() {
  const navigate = useNavigate()
  const { currentRound, matchHistory, reset } = useDraft()

  useEffect(() => {
    if (currentRound !== 'eliminated') {
      navigate('/')
    }
  }, [currentRound, navigate])

  if (currentRound !== 'eliminated') return null

  const lastMatch = matchHistory[matchHistory.length - 1]
  const eliminatedAt = lastMatch ? (ROUND_LABELS[lastMatch.round] ?? lastMatch.round) : ''
  const roundsCleared = matchHistory.filter((m) => m.advanced).length

  function handlePlayAgain() {
    reset()
    navigate('/')
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="animate-dramatic-pulse pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 45% at 50% 25%, rgba(239,68,68,0.16), transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: 'inset 0 0 220px 60px rgba(0,0,0,0.75)' }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        <AppHeader />

        <div className="animate-page-in flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-red-500/30 bg-gradient-to-b from-slate-800 to-slate-950 shadow-2xl shadow-red-950/50">
            <ShieldCrackIcon className="h-11 w-11 text-red-400" />
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.35)] sm:text-6xl">
            Eliminado
          </h1>
          <p className="max-w-md text-lg text-slate-400">
            Tu aventura termina en {eliminatedAt}
            {lastMatch && (
              <>
                {' '}
                frente a {lastMatch.opponent.country} ({lastMatch.opponent.tournament_year})
              </>
            )}
            . {roundsCleared} de 7 partidos superados.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/tournament/summary')}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-4 text-base font-bold text-slate-200 shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800"
            >
              Ver resumen del torneo
            </button>
            <button
              type="button"
              onClick={handlePlayAgain}
              className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-4 text-lg font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              Jugar otro torneo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
