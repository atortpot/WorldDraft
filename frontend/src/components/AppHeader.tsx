import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDraft } from '../context/DraftContext'

// Barra minima con el email del usuario y cerrar sesion, pensada para
// incrustarse arriba de cada pantalla (a diferencia del bloque de HomePage,
// que es mas grande porque ahi comparte protagonismo con el hero).
export function AppHeader() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { reset } = useDraft()

  if (!user) return null

  async function handleLogout() {
    await logout()
    reset()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-slate-950/40 px-4 py-1.5 text-xs">
      <span className="truncate text-slate-500">{user.email}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="shrink-0 rounded-full border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition-all duration-200 hover:border-slate-500 hover:bg-slate-800"
      >
        Cerrar sesion
      </button>
    </div>
  )
}
