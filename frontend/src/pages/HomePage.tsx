import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getActiveDraft } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'

export function HomePage() {
  const navigate = useNavigate()
  const { reset, resumeSession } = useDraft()
  const { user, logout } = useAuth()
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getActiveDraft()
      .then((active) => {
        if (cancelled || !active) return
        resumeSession(active.draft_session_id, active.formation, active.current_round)
        navigate(active.free_slots.length > 0 ? '/draft' : '/tournament', { replace: true })
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleStart() {
    reset()
    navigate('/formation')
  }

  async function handleLogout() {
    await logout()
    reset()
    navigate('/login', { replace: true })
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Comprobando si tienes una partida en curso...
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      {user && (
        <div className="absolute right-4 top-4 flex items-center gap-3">
          <span className="text-sm text-slate-500">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Cerrar sesion
          </button>
        </div>
      )}

      <h1 className="text-4xl font-bold text-slate-50">WorldDraft</h1>
      <p className="max-w-md text-slate-400">
        Elige tu once ideal entre las estrellas de los Mundiales y enfrentalo contra un
        rival historico real.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleStart}
        className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
      >
        Comenzar draft
      </button>
    </div>
  )
}
