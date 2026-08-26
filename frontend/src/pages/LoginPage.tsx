import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-slate-50">WorldDraft</h1>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex gap-2 rounded-lg bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setErrors([])
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
              mode === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
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
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
              mode === 'register' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
              placeholder={mode === 'register' ? 'Minimo 8 caracteres, Aa1!' : 'Tu contraseña'}
            />
          </label>

          {errors.length > 0 && (
            <ul className="flex flex-col gap-1">
              {errors.map((message) => (
                <li key={message} className="text-sm text-red-400">
                  {message}
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
