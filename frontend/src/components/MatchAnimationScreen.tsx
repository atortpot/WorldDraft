import { useEffect, useRef, useState } from 'react'
import { PitchLines } from './PitchLines'
import { MatchPitch } from './MatchPitch'
import { MatchResultPanel } from './MatchResultPanel'
import { BallIcon, PenaltyMissIcon, RedCardIcon, YellowCardIcon } from '../lib/icons'
import type { FormationName, MatchEvent, SimulationResult, TeamMember } from '../api/types'

const TOTAL_MINUTES = 90
const ANIMATION_DURATION_MS = 9000
const TICK_MS = ANIMATION_DURATION_MS / TOTAL_MINUTES

const EVENT_LABELS: Record<MatchEvent['type'], { Icon: typeof BallIcon; label: string }> = {
  goal: { Icon: BallIcon, label: 'GOL' },
  penalty: { Icon: BallIcon, label: 'GOL DE PENALTI' },
  penalty_miss: { Icon: PenaltyMissIcon, label: 'PENALTI FALLADO' },
  yellow_card: { Icon: YellowCardIcon, label: 'AMARILLA' },
  red_card: { Icon: RedCardIcon, label: 'ROJA' },
}

function isGoalEvent(event: MatchEvent): boolean {
  return event.type === 'goal' || event.type === 'penalty'
}

interface Props {
  result: SimulationResult
  onNext: () => void
  team: TeamMember[]
  formation: FormationName
  hideRatings?: boolean
}

export function MatchAnimationScreen({ result, onNext, team, formation, hideRatings }: Props) {
  const narrative = result.narrative

  const [minute, setMinute] = useState(0)
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [revealedEvents, setRevealedEvents] = useState<MatchEvent[]>([])
  const [phase, setPhase] = useState<'animating' | 'finished'>('animating')
  const [flash, setFlash] = useState<'home' | 'away' | null>(null)
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

      if (isGoalEvent(event)) {
        if (event.team === 'home') setScoreHome((s) => s + 1)
        else setScoreAway((s) => s + 1)
        setFlash(event.team)
        setTimeout(() => setFlash(null), 700)
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

  const goalEvents = narrative.events.filter(isGoalEvent)

  return (
    <div className="flex min-h-[75vh] flex-col gap-4">
      {/* Marcador, siempre visible arriba */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <PitchLines />
        </svg>
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${flash ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background:
              flash === 'home'
                ? 'radial-gradient(ellipse at center, rgba(16,185,129,0.35), transparent 70%)'
                : 'radial-gradient(ellipse at center, rgba(239,68,68,0.35), transparent 70%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-2 bg-slate-950/50 px-4 py-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-300">
            {phase === 'animating' ? `Minuto ${minute}'` : 'Final del partido'}
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">
            Tu equipo{' '}
            <span className={flash === 'home' ? 'text-emerald-300' : ''}>{scoreHome}</span>
            {' - '}
            <span className={flash === 'away' ? 'text-red-300' : ''}>{scoreAway}</span> {result.opponent.country}
          </p>
        </div>
      </div>

      {/* Barra de progreso a todo el ancho, con el minuto actual */}
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)] transition-all duration-150 ease-linear"
            style={{ width: `${(minute / TOTAL_MINUTES) * 100}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-300">
          {minute}&apos;
        </span>
      </div>

      {/* Campo compacto con la alineacion propia a un lado (visible tanto
          durante la animacion como una vez terminado el partido) y el feed
          de eventos al otro. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row">
        <div className="w-full shrink-0 sm:w-44">
          <MatchPitch formation={formation} team={team} hideRatings={hideRatings} />
        </div>

        {/* Feed de eventos: ocupa el espacio disponible, el mas reciente
            entra por abajo, los anteriores se quedan visibles mas pequeños. */}
        <div
          ref={feedRef}
          className="glass-card flex min-h-0 flex-1 flex-col justify-end gap-2 rounded-2xl p-4 overflow-y-auto"
        >
          {revealedEvents.length === 0 ? (
            <p className="text-center text-sm text-slate-500">El partido esta a punto de empezar...</p>
          ) : (
            revealedEvents.map((event, index) => {
              const { Icon, label } = EVENT_LABELS[event.type]
              const isHome = event.team === 'home'
              const isLatest = index === revealedEvents.length - 1
              const isGoal = isGoalEvent(event)
              return (
                <div
                  key={`${index}-${event.minute}`}
                  className={`mx-auto flex w-fit items-center gap-2 rounded-full border shadow-lg transition-all ${
                    isLatest && isGoal ? 'animate-goal-impact' : '[animation:event-toast-in_0.3s_ease-out]'
                  } ${
                    isHome
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-red-400/60 bg-red-500/15 text-red-200'
                  } ${
                    isLatest
                      ? isGoal
                        ? 'px-5 py-2.5 text-base font-bold shadow-emerald-950/40'
                        : 'px-4 py-1.5 text-sm font-semibold'
                      : 'px-3 py-1 text-xs opacity-60 shadow-none'
                  }`}
                >
                  <Icon className={isLatest && isGoal ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
                  <span>
                    {label} · {event.player_name} {event.minute}&apos;
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {phase === 'animating' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-2.5 font-semibold text-slate-200 shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800"
          >
            Saltar animacion
          </button>
        </div>
      )}

      {phase === 'finished' && (
        <div className="flex flex-col gap-6">
          <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-7 text-center">
            <p className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
              Tu equipo {narrative.score_home} - {narrative.score_away} {result.opponent.country}{' '}
              {result.opponent.tournament_year}
            </p>

            {goalEvents.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm">
                {goalEvents.map((event, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      event.team === 'home' ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    <BallIcon className="h-3.5 w-3.5" />
                    {event.player_name} {event.minute}&apos;
                    {event.type === 'penalty' ? ' (pen)' : ''}
                  </span>
                ))}
              </div>
            )}

            <p className="text-base text-slate-300">{narrative.closing_text}</p>
          </div>

          <MatchResultPanel result={result} onNext={onNext} />
        </div>
      )}
    </div>
  )
}
