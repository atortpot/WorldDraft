import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getTournamentHistory } from '../api/client'
import { AppHeader } from '../components/AppHeader'
import { TournamentSummary } from '../components/TournamentSummary'
import { useDraft } from '../context/DraftContext'
import type { TournamentHistory } from '../api/types'

export function TournamentSummaryPage() {
  const navigate = useNavigate()
  const { sessionId, reset } = useDraft()
  const [history, setHistory] = useState<TournamentHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Se salta la guarda de abajo cuando "Jugar de nuevo" acaba de vaciar
  // sessionId via reset(): sin esto, el efecto competiria por la
  // navegacion con el navigate('/formation') de handlePlayAgain (mismo
  // problema que hubo en DraftPage al abandonar un draft).
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (leaving) return
    if (!sessionId) {
      navigate('/')
      return
    }
    getTournamentHistory(sessionId)
      .then(setHistory)
      .catch((err) => setError(apiErrorMessage(err)))
  }, [sessionId, navigate, leaving])

  if (!sessionId) return null

  function handlePlayAgain() {
    setLeaving(true)
    reset()
    navigate('/formation')
  }

  return (
    <div className="animate-page-in mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-6">
      <AppHeader />
      {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
      {history ? (
        <TournamentSummary history={history} onPlayAgain={handlePlayAgain} />
      ) : (
        !error && <p className="text-center text-slate-400">Cargando resumen del torneo...</p>
      )}
    </div>
  )
}
