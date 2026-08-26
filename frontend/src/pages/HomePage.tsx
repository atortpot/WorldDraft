import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'

export function HomePage() {
  const navigate = useNavigate()
  const { reset } = useDraft()
  const { user, logout } = useAuth()

  function handleStart() {
    reset()
    navigate('/formation')
  }

  async function handleLogout() {
    await logout()
    reset()
    navigate('/login', { replace: true })
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
