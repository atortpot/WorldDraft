import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft } from '../context/DraftContext'

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

  function handlePlayAgain() {
    reset()
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <p className="text-6xl">💔</p>
      <h1 className="text-5xl font-bold text-red-400">Eliminado</h1>
      <p className="max-w-md text-slate-400">
        Tu aventura termina en {eliminatedAt}
        {lastMatch && (
          <>
            {' '}
            frente a {lastMatch.opponent.country} ({lastMatch.opponent.tournament_year})
          </>
        )}
        . {matchHistory.filter((m) => m.advanced).length} de 7 partidos superados.
      </p>

      <button
        type="button"
        onClick={handlePlayAgain}
        className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
      >
        Jugar otro torneo
      </button>
    </div>
  )
}
