import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

type Mode = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    if (!EMAIL_RE.test(email)) return 'Introduce un email valido.'
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    }
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
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
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
              mode === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
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
              placeholder="Minimo 8 caracteres"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

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
