import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, startDraft } from '../api/client'
import { FormationThumbnail } from '../components/FormationThumbnail'
import { useDraft } from '../context/DraftContext'
import { FORMATION_NAMES } from '../lib/formations'
import type { FormationName } from '../api/types'

export function FormationPage() {
  const navigate = useNavigate()
  const { startSession } = useDraft()
  const [selected, setSelected] = useState<FormationName | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const sessionId = await startDraft(selected)
      startSession(sessionId, selected)
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
