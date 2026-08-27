import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useDraft } from '../context/DraftContext'
import { CheckIcon, TrophyIcon } from '../lib/icons'

const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#38bdf8', '#f472b6', '#f87171', '#facc15', '#a78bfa']

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3.5,
        duration: 3.2 + Math.random() * 2.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: 5 + Math.random() * 5,
        height: 8 + Math.random() * 8,
        rotate: Math.random() * 360,
      })),
    [],
  )

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

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
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(251,191,36,0.18), transparent 70%)',
        }}
      />
      <Confetti />

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        <AppHeader />

        <div className="animate-page-in flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <div className="animate-card-pop flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 shadow-2xl shadow-amber-500/40">
            <TrophyIcon className="h-12 w-12 text-amber-950" />
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight text-amber-400 drop-shadow-[0_0_24px_rgba(251,191,36,0.4)] sm:text-6xl">
            Campeon del Mundo
          </h1>
          <p className="max-w-md text-lg text-slate-300">
            Tu equipo ha ganado los 7 partidos del torneo, incluida la final. Un once para la
            historia.
          </p>

          <ul className="flex w-full max-w-md flex-col gap-2">
            {matchHistory.map((match) => (
              <li
                key={match.round}
                className="glass-card flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                  {match.round}
                </span>
                <span className="text-xs text-slate-500">
                  vs {match.opponent.country} ({match.opponent.tournament_year})
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-4 text-lg font-bold text-amber-950 shadow-lg shadow-amber-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          >
            Jugar otro torneo
          </button>
        </div>
      </div>
    </div>
  )
}
