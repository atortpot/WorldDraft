import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ShieldIcon } from '../lib/icons'
import { collectRegisterErrors } from '../lib/validation'

type Mode = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status, login, register } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // Si el arranque de la app ya confirmo que hay una cookie de sesion
  // valida, no hace falta pasar por el formulario.
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  function validate(): string[] {
    if (mode === 'register') {
      return collectRegisterErrors(email, password)
    }
    // En login no se valida la fuerza de la password (bloquearia a
    // usuarios ya registrados con contraseñas anteriores a esta regla):
    // solo una comprobacion minima de que los campos no esten vacios.
    const empty: string[] = []
    if (!email) empty.push('Introduce tu email.')
    if (!password) empty.push('Introduce tu contraseña.')
    return empty
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors([])
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setErrors([apiErrorMessage(err)])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-page-in flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2">
        <ShieldIcon className="h-10 w-10 text-emerald-400 drop-shadow-[0_0_14px_rgba(16,185,129,0.5)]" />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">WorldDraft</h1>
      </div>

      <div className="glass-card flex w-full max-w-sm flex-col gap-5 rounded-2xl p-7 shadow-2xl">
        <div className="flex gap-1.5 rounded-xl bg-slate-950/70 p-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setErrors([])
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all duration-200 ${
              mode === 'login'
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-emerald-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setErrors([])
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all duration-200 ${
              mode === 'register'
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-emerald-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-300">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-slate-100 outline-none transition-colors focus:border-emerald-400"
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-300">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-slate-100 outline-none transition-colors focus:border-emerald-400"
              placeholder={mode === 'register' ? 'Minimo 8 caracteres, Aa1!' : 'Tu contraseña'}
            />
          </label>

          {errors.length > 0 && (
            <ul className="flex flex-col gap-1">
              {errors.map((message) => (
                <li key={message} className="text-sm font-medium text-red-400">
                  {message}
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-3 font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading
              ? 'Un momento...'
              : mode === 'login'
                ? 'Iniciar sesion'
                : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
