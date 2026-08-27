import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, startDraft } from '../api/client'
import { AppHeader } from '../components/AppHeader'
import { FormationThumbnail } from '../components/FormationThumbnail'
import { useDraft } from '../context/DraftContext'
import { FORMATION_NAMES } from '../lib/formations'
import type { DraftMode, FormationName } from '../api/types'

const MODES: { value: DraftMode; label: string; description: string }[] = [
  {
    value: 'classic',
    label: 'Modo Clasico',
    description: 'Nombre, posicion, año del torneo y rating a la vista.',
  },
  {
    value: 'almanac',
    label: 'Folgar Mode',
    description: 'El rating se oculta: confia en tu memoria futbolistica.',
  },
]

export function FormationPage() {
  const navigate = useNavigate()
  const { startSession } = useDraft()
  const [selected, setSelected] = useState<FormationName | null>(null)
  const [mode, setMode] = useState<DraftMode>('classic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const sessionId = await startDraft(selected)
      startSession(sessionId, selected, mode)
      navigate('/draft')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-page-in mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-6">
      <AppHeader />
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl">
          Elige tu formacion
        </h1>
        <p className="text-base text-slate-400">Determina que slots tendra que cubrir tu equipo.</p>
      </header>

      {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {FORMATION_NAMES.map((formation) => {
          const isSelected = selected === formation
          return (
            <button
              key={formation}
              type="button"
              onClick={() => setSelected(formation)}
              className={`glass-card group flex flex-col items-center gap-3 rounded-2xl p-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/40 ${
                isSelected
                  ? 'border-emerald-400/70 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                  : 'hover:border-slate-600'
              }`}
            >
              <div className="h-32 w-24 overflow-hidden rounded-lg shadow-inner transition-transform duration-200 group-hover:scale-[1.03]">
                <FormationThumbnail formation={formation} />
              </div>
              <span
                className={`text-sm font-bold tracking-tight ${isSelected ? 'text-emerald-300' : 'text-slate-100'}`}
              >
                {formation}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Modo de draft
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((option) => {
            const isSelected = mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`glass-card flex flex-col gap-1.5 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                  isSelected
                    ? 'border-emerald-400/70 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/40'
                    : 'hover:border-slate-600'
                }`}
              >
                <span className={`text-sm font-bold ${isSelected ? 'text-emerald-300' : 'text-slate-100'}`}>
                  {option.label}
                </span>
                <span className="text-xs leading-relaxed text-slate-400">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={!selected || loading}
          className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
        >
          {loading ? 'Creando draft...' : 'Empezar draft'}
        </button>
      </div>
    </div>
  )
}
