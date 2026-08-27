import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getActiveDraft } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'
import { ShieldIcon } from '../lib/icons'

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
    <div className="animate-page-in relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      {user && (
        <div className="glass-card absolute right-4 top-4 flex items-center gap-3 rounded-full px-4 py-2">
          <span className="text-sm text-slate-400">{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-700 px-3.5 py-1.5 text-sm font-semibold text-slate-300 transition-all duration-200 hover:border-slate-500 hover:bg-slate-800"
          >
            Cerrar sesion
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <ShieldIcon className="h-14 w-14 text-emerald-400 drop-shadow-[0_0_16px_rgba(16,185,129,0.5)]" />
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-50 sm:text-6xl">WorldDraft</h1>
        <p className="max-w-md text-lg text-slate-400">
          Elige tu once ideal entre las estrellas de los Mundiales y enfrentalo contra un
          rival historico real.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleStart}
        className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-4 text-lg font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-900/50"
      >
        Comenzar draft
      </button>
    </div>
  )
}
