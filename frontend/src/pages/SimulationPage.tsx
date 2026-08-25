import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getTeam, simulateMatch } from '../api/client'
import { useDraft } from '../context/DraftContext'
import type { TeamMember } from '../api/types'

// app/game/router.py devuelve el position_slot del equipo como el valor
// completo del enum (PlayerPosition.value), no la abreviatura GK/DF/MF/FW
// que usa el endpoint de candidatos.
const POSITION_ABBREVIATION: Record<string, string> = {
  goalkeeper: 'GK',
  defender: 'DF',
  midfielder: 'MF',
  forward: 'FW',
}

export function SimulationPage() {
  const navigate = useNavigate()
  const { sessionId, setResult } = useDraft()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    getTeam(sessionId)
      .then(setTeam)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [sessionId, navigate])

  async function handleSimulate() {
    if (!sessionId) return
    setSimulating(true)
    setError(null)
    try {
      const result = await simulateMatch(sessionId)
      setResult(result)
      navigate('/result')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold text-slate-50">Tu equipo esta listo</h1>
        <p className="text-slate-400">
          Tu rival se revelara al simular el partido: un equipo real de un Mundial elegido
          al azar.
        </p>
      </header>

      {loading ? (
        <p className="text-center text-slate-400">Cargando equipo...</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {team.map((member) => (
            <li
              key={member.pick_id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-2"
            >
              <div>
                <p className="font-medium text-slate-100">{member.name}</p>
                <p className="text-xs text-slate-500">
                  {member.country} · {member.tournament_year}
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {POSITION_ABBREVIATION[member.position_slot] ?? member.position_slot}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSimulate}
          disabled={simulating || loading}
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {simulating ? 'Simulando partido...' : 'Simular partido'}
        </button>
      </div>
    </div>
  )
}
