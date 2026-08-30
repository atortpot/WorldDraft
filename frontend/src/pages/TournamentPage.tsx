import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getGroupTable, getTeam, simulateMatch } from '../api/client'
import { AppHeader } from '../components/AppHeader'
import { GroupStandingsTable } from '../components/GroupStandingsTable'
import { MatchAnimationScreen } from '../components/MatchAnimationScreen'
import { TournamentProgress } from '../components/TournamentProgress'
import { useDraft } from '../context/DraftContext'
import type { GroupTable, SimulationResult, TeamMember } from '../api/types'

const GROUP_ROUNDS = new Set(['group_1', 'group_2', 'group_3'])

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
  const { sessionId, formation, mode, currentRound, matchHistory, recordMatchResult } = useDraft()
  const hideRatings = mode === 'almanac'

  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupTable, setGroupTable] = useState<GroupTable | null>(null)
  const isGroupStage = GROUP_ROUNDS.has(currentRound)
  // El resultado se guarda aqui (no en el contexto) hasta que el usuario lo
  // reconoce: si actualizasemos currentRound/matchHistory nada mas llegar
  // la respuesta, TournamentProgress ya mostraria el icono de victoria/
  // derrota de esta ronda mientras la animacion todavia esta en marcha,
  // arruinando la sorpresa que es el objetivo de la animacion.
  const [pendingResult, setPendingResult] = useState<SimulationResult | null>(null)

  useEffect(() => {
    if (!sessionId || !formation) {
      navigate('/')
      return
    }
    getTeam(sessionId)
      .then(setTeam)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingTeam(false))
  }, [sessionId, formation, navigate])

  // Se recarga cada vez que currentRound cambia de ronda de grupos (group_1
  // -> group_2 -> group_3), que es exactamente cuando cambia tras cada
  // partido: asi la tabla se ve "en tiempo real" sin depender de guardar
  // el group_table de cada respuesta de /simulate por separado.
  useEffect(() => {
    if (!sessionId || !isGroupStage) {
      setGroupTable(null)
      return
    }
    getGroupTable(sessionId)
      .then(setGroupTable)
      .catch((err) => setError(apiErrorMessage(err)))
  }, [sessionId, isGroupStage, currentRound])

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

  if (!sessionId || !formation) return null

  const roundLabel = ROUND_LABELS[currentRound] ?? currentRound

  return (
    <div className="animate-page-in mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-6">
      <AppHeader />
      <header className="flex flex-col items-center gap-5 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">Torneo de 7 partidos</h1>
        <TournamentProgress currentRound={currentRound} matchHistory={matchHistory} />
      </header>

      {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}

      {pendingResult ? (
        <MatchAnimationScreen
          result={pendingResult}
          onNext={handleResultAcknowledged}
          team={team}
          formation={formation}
          hideRatings={hideRatings}
        />
      ) : (
        <section className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-slate-100">{roundLabel}</h2>
          <p className="max-w-md text-center text-slate-400">
            {isGroupStage
              ? 'Tu rival de este partido es uno de los 3 equipos historicos de tu grupo.'
              : 'Tu rival se revelara al jugar el partido: un equipo real de un Mundial elegido segun la exigencia de esta ronda.'}
          </p>

          {isGroupStage && groupTable && (
            <div className="w-full">
              <GroupStandingsTable table={groupTable} />
            </div>
          )}

          {loadingTeam ? (
            <p className="text-slate-400">Cargando equipo...</p>
          ) : (
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {team.map((member) => (
                <li
                  key={member.pick_id}
                  className="glass-card flex items-center justify-between rounded-xl px-4 py-2.5"
                >
                  <p className="font-semibold text-slate-100">{member.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{member.tournament_year}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-emerald-400">
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
            className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {simulating ? 'Simulando partido...' : 'Jugar partido'}
          </button>
        </section>
      )}
    </div>
  )
}
