import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, startDraft } from '../api/client'
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
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-slate-50">Elige tu formacion</h1>
        <p className="text-slate-400">Determina que slots tendra que cubrir tu equipo.</p>
      </header>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {FORMATION_NAMES.map((formation) => {
          const isSelected = selected === formation
          return (
            <button
              key={formation}
              type="button"
              onClick={() => setSelected(formation)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <div className="h-28 w-20">
                <FormationThumbnail formation={formation} />
              </div>
              <span className="text-sm font-semibold text-slate-100">{formation}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-center text-sm font-medium uppercase tracking-wide text-slate-500">
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
                className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <span className="text-sm font-semibold text-slate-100">{option.label}</span>
                <span className="text-xs text-slate-400">{option.description}</span>
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
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creando draft...' : 'Empezar draft'}
        </button>
      </div>
    </div>
  )
}
