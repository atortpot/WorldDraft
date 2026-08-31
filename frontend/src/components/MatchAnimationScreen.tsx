import { useEffect, useRef, useState } from 'react'
import { PitchLines } from './PitchLines'
import { MatchPitch } from './MatchPitch'
import { MatchResultPanel } from './MatchResultPanel'
import { PenaltyShootoutSummary } from './PenaltyShootout'
import { BallIcon, PenaltyMissIcon, RedCardIcon, YellowCardIcon } from '../lib/icons'
import type { FormationName, MatchEvent, SimulationResult, TeamMember } from '../api/types'

const REGULATION_MINUTES = 90
const EXTRA_TIME_MINUTES = 120
const TICK_MS = 100 // ~9s para los 90' reglamentarios, escalado si hay prorroga
const PENALTY_KICK_REVEAL_MS = 800
const BANNER_DURATION_MS = 3000

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

type Phase = 'animating' | 'penalties' | 'finished'

export function MatchAnimationScreen({ result, onNext, team, formation, hideRatings }: Props) {
  const narrative = result.narrative
  const totalMinutes = result.went_to_extra_time ? EXTRA_TIME_MINUTES : REGULATION_MINUTES

  const [minute, setMinute] = useState(0)
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [revealedEvents, setRevealedEvents] = useState<MatchEvent[]>([])
  const [phase, setPhase] = useState<Phase>('animating')
  const [flash, setFlash] = useState<'home' | 'away' | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [revealedKicks, setRevealedKicks] = useState(0)
  const firedIndices = useRef(new Set<number>())
  const feedRef = useRef<HTMLDivElement>(null)
  const bannerTimeoutRef = useRef<number | null>(null)

  function showBanner(message: string) {
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
    setBanner(message)
    bannerTimeoutRef.current = window.setTimeout(() => setBanner(null), BANNER_DURATION_MS)
  }

  // Avanza el minuto animado de 0 a 90 (o a 120 si hubo prorroga) en pasos
  // de TICK_MS. Si hay prorroga, al cruzar el 90 no se para: se avisa con
  // un mensaje y se sigue hasta el 120, con la misma animacion.
  useEffect(() => {
    if (phase !== 'animating') return

    const interval = setInterval(() => {
      setMinute((current) => {
        const next = current + 1

        if (result.went_to_extra_time && next === REGULATION_MINUTES) {
          showBanner('¡Empate! Se va a la prórroga')
        }

        if (next >= totalMinutes) {
          clearInterval(interval)
          if (result.penalties) {
            showBanner('¡Sigue el empate! Tanda de penaltis')
            setPhase('penalties')
          } else {
            setPhase('finished')
          }
          return totalMinutes
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, totalMinutes])

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
    }
  }, [])

  // Dispara los eventos cuyo minuto ya se alcanzo (una sola vez cada uno,
  // reglamentario o prorroga por igual); se acumulan en el feed, no
  // desaparecen.
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

  // Revela los lanzamientos de la tanda uno a uno.
  useEffect(() => {
    if (phase !== 'penalties' || !result.penalties) return
    if (revealedKicks >= result.penalties.kicks.length) return
    const timeout = window.setTimeout(() => setRevealedKicks((n) => n + 1), PENALTY_KICK_REVEAL_MS)
    return () => window.clearTimeout(timeout)
  }, [phase, revealedKicks, result.penalties])

  function handleSkip() {
    narrative.events.forEach((_, index) => firedIndices.current.add(index))
    setScoreHome(narrative.score_home)
    setScoreAway(narrative.score_away)
    setRevealedEvents(narrative.events)
    setMinute(totalMinutes)
    if (result.penalties) setRevealedKicks(result.penalties.kicks.length)
    setBanner(null)
    setPhase('finished')
  }

  const goalEvents = narrative.events.filter(isGoalEvent)
  const kicks = result.penalties?.kicks ?? []
  const revealedKicksList = kicks.slice(0, revealedKicks)
  const penaltyScoreHome = revealedKicksList.filter((k) => k.team === 'home' && k.scored).length
  const penaltyScoreAway = revealedKicksList.filter((k) => k.team === 'away' && k.scored).length
  const penaltiesFullyRevealed = kicks.length > 0 && revealedKicks >= kicks.length

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
          {banner && (
            <p className="animate-card-pop rounded-full border border-amber-400/50 bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-300">
              {banner}
            </p>
          )}
        </div>
      </div>

      {phase === 'animating' && (
        <>
          {/* Barra de progreso a todo el ancho, con el minuto actual */}
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)] transition-all duration-150 ease-linear"
                style={{ width: `${(minute / totalMinutes) * 100}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-300">
              {minute}&apos;
            </span>
          </div>

          {/* Campo compacto con la alineacion propia a un lado y el feed
              de eventos al otro. */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row">
            <div className="w-full shrink-0 sm:w-44">
              <MatchPitch formation={formation} team={team} hideRatings={hideRatings} />
            </div>

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

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-2.5 font-semibold text-slate-200 shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800"
            >
              Saltar animacion
            </button>
          </div>
        </>
      )}

      {phase === 'penalties' && result.penalties && (
        <div className="flex flex-1 flex-col gap-6">
          <div className="glass-card flex flex-col items-center gap-2 rounded-2xl p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Tanda de penaltis</p>
            <p className="text-4xl font-extrabold tracking-tight text-white">
              {penaltyScoreHome} - {penaltyScoreAway}
            </p>
          </div>

          <div className="glass-card flex min-h-0 flex-1 flex-col gap-2 rounded-2xl p-4">
            {revealedKicksList.length === 0 ? (
              <p className="text-center text-sm text-slate-500">Primer lanzamiento...</p>
            ) : (
              revealedKicksList.map((kick, index) => {
                const isHome = kick.team === 'home'
                const isLatest = index === revealedKicksList.length - 1
                return (
                  <div
                    key={index}
                    className={`flex w-fit items-center gap-2 rounded-full border px-4 py-2 shadow-lg transition-all ${
                      isLatest ? 'animate-card-pop' : ''
                    } ${isHome ? 'self-start' : 'self-end'} ${
                      kick.scored
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                        : 'border-red-400/60 bg-red-500/15 text-red-200'
                    }`}
                  >
                    {kick.scored ? <BallIcon className="h-4 w-4" /> : <PenaltyMissIcon className="h-4 w-4" />}
                    <span className="text-sm font-semibold">{kick.player_name}</span>
                  </div>
                )
              })
            )}
          </div>

          {penaltiesFullyRevealed && (
            <div className="flex flex-col items-center gap-4">
              <p className={`text-lg font-bold ${result.penalties.won_by_team ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.penalties.won_by_team ? 'Ganas la tanda de penaltis' : 'Pierdes la tanda de penaltis'}
              </p>
              <button
                type="button"
                onClick={() => setPhase('finished')}
                className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                Continuar
              </button>
            </div>
          )}

          {!penaltiesFullyRevealed && (
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

            {result.penalties && <PenaltyShootoutSummary penalties={result.penalties} />}
          </div>

          <MatchResultPanel result={result} onNext={onNext} />
        </div>
      )}
    </div>
  )
}
