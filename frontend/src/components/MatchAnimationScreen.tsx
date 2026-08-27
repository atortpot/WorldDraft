import { useEffect, useRef, useState } from 'react'
import { PitchLines } from './PitchLines'
import { MatchResultPanel } from './MatchResultPanel'
import type { MatchEvent, SimulationResult } from '../api/types'

const TOTAL_MINUTES = 90
const ANIMATION_DURATION_MS = 9000
const TICK_MS = ANIMATION_DURATION_MS / TOTAL_MINUTES

const EVENT_LABELS: Record<MatchEvent['type'], { icon: string; label: string }> = {
  goal: { icon: '⚽', label: 'GOL' },
  penalty: { icon: '⚽', label: 'GOL DE PENALTI' },
  penalty_miss: { icon: '❌', label: 'PENALTI FALLADO' },
  yellow_card: { icon: '🟨', label: 'AMARILLA' },
  red_card: { icon: '🟥', label: 'ROJA' },
}

interface Props {
  result: SimulationResult
  onNext: () => void
}

export function MatchAnimationScreen({ result, onNext }: Props) {
  const narrative = result.narrative

  const [minute, setMinute] = useState(0)
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [revealedEvents, setRevealedEvents] = useState<MatchEvent[]>([])
  const [phase, setPhase] = useState<'animating' | 'finished'>('animating')
  const firedIndices = useRef(new Set<number>())
  const feedRef = useRef<HTMLDivElement>(null)

  // Avanza el minuto animado de 0 a 90 en ANIMATION_DURATION_MS.
  useEffect(() => {
    if (phase !== 'animating') return

    const interval = setInterval(() => {
      setMinute((current) => {
        if (current + 1 >= TOTAL_MINUTES) {
          clearInterval(interval)
          setPhase('finished')
          return TOTAL_MINUTES
        }
        return current + 1
      })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [phase])

  // Dispara los eventos cuyo minuto ya se alcanzo (una sola vez cada uno);
  // se acumulan en el feed, no desaparecen.
  useEffect(() => {
    narrative.events.forEach((event, index) => {
      if (event.minute > minute || firedIndices.current.has(index)) return
      firedIndices.current.add(index)

      if (event.type === 'goal' || event.type === 'penalty') {
        if (event.team === 'home') setScoreHome((s) => s + 1)
        else setScoreAway((s) => s + 1)
      }

      setRevealedEvents((prev) => [...prev, event])
    })
  }, [minute, narrative.events])

  // El nuevo evento siempre entra por abajo: mantiene el feed pegado al
  // fondo segun va creciendo.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [revealedEvents.length])

  function handleSkip() {
    narrative.events.forEach((_, index) => firedIndices.current.add(index))
    setScoreHome(narrative.score_home)
    setScoreAway(narrative.score_away)
    setRevealedEvents(narrative.events)
    setMinute(TOTAL_MINUTES)
    setPhase('finished')
  }

  const goalEvents = narrative.events.filter((event) => event.type === 'goal' || event.type === 'penalty')

  return (
    <div className="flex min-h-[75vh] flex-col gap-4">
      {/* Marcador, siempre visible arriba */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-lg">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <PitchLines />
        </svg>
        <div className="relative flex flex-col items-center gap-1 bg-slate-950/50 px-4 py-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
            {phase === 'animating' ? `Minuto ${minute}'` : 'Final del partido'}
          </p>
          <p className="text-2xl font-bold text-white drop-shadow sm:text-4xl">
            Tu equipo {scoreHome} - {scoreAway} {result.opponent.country}
          </p>
        </div>
      </div>

      {/* Barra de progreso a todo el ancho, con el minuto actual */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-150 ease-linear"
            style={{ width: `${(minute / TOTAL_MINUTES) * 100}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-slate-400">
          {minute}&apos;
        </span>
      </div>

      {/* Feed de eventos: ocupa el espacio disponible, el mas reciente
          entra por abajo, los anteriores se quedan visibles mas pequeños. */}
      <div
        ref={feedRef}
        className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
      >
        {revealedEvents.length === 0 ? (
          <p className="text-center text-sm text-slate-500">El partido esta a punto de empezar...</p>
        ) : (
          revealedEvents.map((event, index) => {
            const { icon, label } = EVENT_LABELS[event.type]
            const isHome = event.team === 'home'
            const isLatest = index === revealedEvents.length - 1
            return (
              <div
                key={`${index}-${event.minute}`}
                className={`mx-auto flex w-fit items-center gap-2 rounded-full border transition-all [animation:event-toast-in_0.3s_ease-out] ${
                  isHome
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                    : 'border-red-400/60 bg-red-500/15 text-red-200'
                } ${
                  isLatest
                    ? 'px-4 py-1.5 text-sm font-semibold shadow-lg'
                    : 'px-3 py-1 text-xs opacity-60'
                }`}
              >
                <span>{icon}</span>
                <span>
                  {label} · {event.player_name} {event.minute}&apos;
                </span>
              </div>
            )
          })
        )}
      </div>

      {phase === 'animating' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg border border-slate-700 px-6 py-2.5 font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Saltar animacion
          </button>
        </div>
      )}

      {phase === 'finished' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-2xl font-bold text-slate-50 sm:text-3xl">
              Tu equipo {narrative.score_home} - {narrative.score_away} {result.opponent.country}{' '}
              {result.opponent.tournament_year}
            </p>

            {goalEvents.length > 0 && (
              <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm">
                {goalEvents.map((event, index) => (
                  <span
                    key={index}
                    className={event.team === 'home' ? 'text-emerald-300' : 'text-red-300'}
                  >
                    {index > 0 && <span className="mr-1 text-slate-600">·</span>}⚽ {event.player_name}{' '}
                    {event.minute}&apos;{event.type === 'penalty' ? ' (pen)' : ''}
                  </span>
                ))}
              </p>
            )}

            <p className="text-base text-slate-300">{narrative.closing_text}</p>
          </div>

          <MatchResultPanel result={result} onNext={onNext} />
        </div>
      )}
    </div>
  )
}
