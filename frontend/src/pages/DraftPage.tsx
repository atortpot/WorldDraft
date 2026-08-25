import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getCandidates, pickPlayer } from '../api/client'
import { CandidateCard } from '../components/CandidateCard'
import { useDraft } from '../context/DraftContext'
import type { Candidate, PositionAbbreviation } from '../api/types'

interface PositionSlot {
  code: PositionAbbreviation
  label: string
  count: number
}

// Debe coincidir con FORMATION en app/game/draft_service.py: 1 GK, 4 DF, 4 MF, 2 FW.
const POSITIONS: PositionSlot[] = [
  { code: 'GK', label: 'Portero', count: 1 },
  { code: 'DF', label: 'Defensa', count: 4 },
  { code: 'MF', label: 'Centrocampista', count: 4 },
  { code: 'FW', label: 'Delantero', count: 2 },
]

interface PickedSummary {
  name: string
  position: PositionAbbreviation
}

export function DraftPage() {
  const navigate = useNavigate()
  const { sessionId } = useDraft()

  const [positionIndex, setPositionIndex] = useState(0)
  const [slotInPosition, setSlotInPosition] = useState(0)
  const [picks, setPicks] = useState<PickedSummary[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentPosition = POSITIONS[positionIndex]

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    if (!currentPosition) {
      navigate('/simulate')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    getCandidates(sessionId, currentPosition.code)
      .then((data) => {
        if (!cancelled) setCandidates(data)
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, positionIndex, slotInPosition])

  async function handlePick(candidate: Candidate) {
    if (!sessionId || !currentPosition) return
    setPicking(true)
    setError(null)
    try {
      await pickPlayer(sessionId, candidate.id, currentPosition.code)
      setPicks((prev) => [...prev, { name: candidate.name, position: currentPosition.code }])

      if (slotInPosition + 1 >= currentPosition.count) {
        setPositionIndex((i) => i + 1)
        setSlotInPosition(0)
      } else {
        setSlotInPosition((s) => s + 1)
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPicking(false)
    }
  }

  const totalSlots = POSITIONS.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-50">Arma tu equipo</h1>
        <p className="text-sm text-slate-400">
          {picks.length} / {totalSlots} jugadores elegidos
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(picks.length / totalSlots) * 100}%` }}
          />
        </div>
      </header>

      {currentPosition && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-200">
            {currentPosition.label} ({slotInPosition + 1}/{currentPosition.count})
          </h2>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {loading ? (
            <p className="text-slate-400">Buscando candidatos...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  disabled={picking}
                  onPick={handlePick}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {picks.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-slate-800 pt-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Tu equipo hasta ahora
          </h2>
          <ul className="flex flex-wrap gap-2">
            {picks.map((pick, index) => (
              <li
                key={index}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
              >
                {pick.position} · {pick.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
