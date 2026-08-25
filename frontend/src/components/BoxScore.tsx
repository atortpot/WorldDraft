import type { FormationName, TeamMember } from '../api/types'
import { FORMATIONS } from '../lib/formations'

interface Props {
  formation: FormationName
  team: TeamMember[]
}

export function BoxScore({ formation, team }: Props) {
  const slots = FORMATIONS[formation]
  const teamBySlot = new Map(team.map((member) => [member.slot_index, member]))
  const avgRating = team.length > 0 ? team.reduce((sum, m) => sum + m.rating, 0) / team.length : 0

  return (
    <div className="flex w-full flex-col gap-2 sm:w-64">
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-500">Alineacion</h3>
      <ul className="flex flex-col gap-1">
        {slots.map((position, index) => {
          const member = teamBySlot.get(index)
          return (
            <li
              key={index}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm"
            >
              <span className="w-10 shrink-0 font-mono text-xs text-slate-500">{position}</span>
              <span className={`truncate text-right ${member ? 'text-slate-100' : 'text-slate-600'}`}>
                {member ? member.name : '---'}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
        <span className="text-sm font-medium text-slate-300">Rating medio</span>
        <span className="text-lg font-bold text-emerald-400">{avgRating.toFixed(1)}</span>
      </div>
    </div>
  )
}
