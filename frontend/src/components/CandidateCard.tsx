import type { Candidate } from '../api/types'

interface Props {
  candidate: Candidate
  disabled: boolean
  onPick: (candidate: Candidate) => void
}

export function CandidateCard({ candidate, disabled, onPick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(candidate)}
      className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-emerald-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-100">{candidate.name}</h3>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          {candidate.rating.toFixed(1)}
        </span>
      </div>
      <p className="text-sm text-slate-400">
        {candidate.country} · Mundial {candidate.tournament_year}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
        <div>
          <dt className="uppercase tracking-wide">Goles</dt>
          <dd className="text-sm font-medium text-slate-200">{candidate.goals}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Asist.</dt>
          <dd className="text-sm font-medium text-slate-200">{candidate.assists}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Min.</dt>
          <dd className="text-sm font-medium text-slate-200">{candidate.minutes_played}</dd>
        </div>
      </dl>
    </button>
  )
}
