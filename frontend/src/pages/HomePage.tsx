import { useNavigate } from 'react-router-dom'
import { useDraft } from '../context/DraftContext'

export function HomePage() {
  const navigate = useNavigate()
  const { reset } = useDraft()

  function handleStart() {
    reset()
    navigate('/formation')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
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
