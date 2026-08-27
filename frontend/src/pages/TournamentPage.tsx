import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getTeam, simulateMatch } from '../api/client'
import { MatchAnimationScreen } from '../components/MatchAnimationScreen'
import { TournamentProgress } from '../components/TournamentProgress'
import { useDraft } from '../context/DraftContext'
import type { SimulationResult, TeamMember } from '../api/types'

const ROUND_LABELS: Record<string, string> = {
  group_1: 'Partido de grupos 1',
  group_2: 'Partido de grupos 2',
  group_3: 'Partido de grupos 3',
  round_of_16: 'Octavos de final',
  quarter_final: 'Cuartos de final',
  semi_final: 'Semifinal',
  final: 'Final',
}

export function TournamentPage() {
  const navigate = useNavigate()
  const { sessionId, currentRound, matchHistory, recordMatchResult } = useDraft()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El resultado se guarda aqui (no en el contexto) hasta que el usuario lo
  // reconoce: si actualizasemos currentRound/matchHistory nada mas llegar
  // la respuesta, TournamentProgress ya mostraria el icono de victoria/
  // derrota de esta ronda mientras la animacion todavia esta en marcha,
  // arruinando la sorpresa que es el objetivo de la animacion.
  const [pendingResult, setPendingResult] = useState<SimulationResult | null>(null)

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    getTeam(sessionId)
      .then(setTeam)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingTeam(false))
  }, [sessionId, navigate])

  // El equipo ya jugo el ultimo partido de su historial (final o
  // eliminatoria perdida): navega a la pantalla final correspondiente, pero
  // solo despues de que el jugador haya reconocido el resultado (lo que
  // actualiza currentRound).
  useEffect(() => {
    if (pendingResult) return
    if (currentRound === 'champion') navigate('/tournament/champion')
    else if (currentRound === 'eliminated') navigate('/tournament/eliminated')
  }, [currentRound, pendingResult, navigate])

  async function handleSimulate() {
    if (!sessionId) return
    setSimulating(true)
    setError(null)
    try {
      setPendingResult(await simulateMatch(sessionId))
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSimulating(false)
    }
  }

  function handleResultAcknowledged() {
    if (!pendingResult) return
    recordMatchResult(pendingResult)
    setPendingResult(null)
  }

  const roundLabel = ROUND_LABELS[currentRound] ?? currentRound

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-slate-50">Torneo de 7 partidos</h1>
        <TournamentProgress currentRound={currentRound} matchHistory={matchHistory} />
      </header>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {pendingResult ? (
        <MatchAnimationScreen result={pendingResult} onNext={handleResultAcknowledged} />
      ) : (
        <section className="flex flex-col items-center gap-6">
          <h2 className="text-xl font-semibold text-slate-200">{roundLabel}</h2>
          <p className="text-center text-slate-400">
            Tu rival se revelara al jugar el partido: un equipo real de un Mundial elegido
            segun la exigencia de esta ronda.
          </p>

          {loadingTeam ? (
            <p className="text-slate-400">Cargando equipo...</p>
          ) : (
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {team.map((member) => (
                <li
                  key={member.pick_id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-2"
                >
                  <p className="font-medium text-slate-100">{member.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{member.tournament_year}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      {member.rating.toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleSimulate}
            disabled={simulating || loadingTeam}
            className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {simulating ? 'Simulando partido...' : 'Jugar partido'}
          </button>
        </section>
      )}
    </div>
  )
}
