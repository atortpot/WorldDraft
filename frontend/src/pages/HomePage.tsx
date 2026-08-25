import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, startDraft } from '../api/client'
import { useDraft } from '../context/DraftContext'

export function HomePage() {
  const navigate = useNavigate()
  const { setSessionId, reset } = useDraft()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      reset()
      const sessionId = await startDraft()
      setSessionId(sessionId)
      navigate('/draft')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold text-slate-50">WorldDraft</h1>
      <p className="max-w-md text-slate-400">
        Elige tu once ideal entre las estrellas de los Mundiales y enfrentalo contra un
        rival historico real.
      </p>
      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Creando draft...' : 'Comenzar draft'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
