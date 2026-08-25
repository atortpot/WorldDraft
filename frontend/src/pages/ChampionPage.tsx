import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft } from '../context/DraftContext'

export function ChampionPage() {
  const navigate = useNavigate()
  const { currentRound, matchHistory, reset } = useDraft()

  useEffect(() => {
    if (currentRound !== 'champion') {
      navigate('/')
    }
  }, [currentRound, navigate])

  if (currentRound !== 'champion') return null

  function handlePlayAgain() {
    reset()
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <p className="text-6xl">🏆</p>
      <h1 className="text-5xl font-bold text-amber-400">Campeon del Mundo</h1>
      <p className="max-w-md text-slate-400">
        Tu equipo ha ganado los 7 partidos del torneo, incluida la final. Un once para la
        historia.
      </p>

      <ul className="flex flex-col gap-2">
        {matchHistory.map((match) => (
          <li key={match.round} className="text-sm text-slate-500">
            {match.round} · vs {match.opponent.country} ({match.opponent.tournament_year}) ·{' '}
            <span className="text-emerald-400">{match.result}</span>
          </li>
        ))}
      </ul>

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
