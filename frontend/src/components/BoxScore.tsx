import type { FormationName, TeamMember } from '../api/types'
import { FORMATIONS } from '../lib/formations'

interface Props {
  formation: FormationName
  team: TeamMember[]
  hideRatings?: boolean
}

export function BoxScore({ formation, team, hideRatings }: Props) {
  const slots = FORMATIONS[formation]
  const teamBySlot = new Map(team.map((member) => [member.slot_index, member]))
  const avgRating = team.length > 0 ? team.reduce((sum, m) => sum + m.rating, 0) / team.length : 0

  return (
    <div className="glass-card flex w-full flex-col gap-2.5 rounded-2xl p-4 sm:w-72">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Alineacion</h3>
      <ul className="flex flex-col gap-1.5">
        {slots.map((position, index) => {
          const member = teamBySlot.get(index)
          return (
            <li
              key={index}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                member ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800/60 bg-slate-950/40'
              }`}
            >
              <span className="w-10 shrink-0 font-mono text-xs font-semibold text-slate-500">{position}</span>
              <span className={`truncate text-right ${member ? 'font-medium text-slate-100' : 'text-slate-600'}`}>
                {member ? member.name : '---'}
              </span>
            </li>
          )
        })}
      </ul>
      {!hideRatings && (
        <div className="mt-1 flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-800 to-slate-800/60 px-3.5 py-2.5">
          <span className="text-sm font-semibold text-slate-300">Rating medio</span>
          <span className="text-xl font-extrabold text-emerald-400">{avgRating.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}
