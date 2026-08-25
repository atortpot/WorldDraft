import type { FormationName, RollPlayer, TeamMember } from '../api/types'
import { computeLayout, isSlotCompatible } from '../lib/formations'
import { PitchLines } from './PitchLines'

interface Props {
  formation: FormationName
  team: TeamMember[]
  selectedPlayer: RollPlayer | null
  onSlotClick: (slotIndex: number) => void
  disabled: boolean
}

export function Pitch({ formation, team, selectedPlayer, onSlotClick, disabled }: Props) {
  const layout = computeLayout(formation)
  const teamBySlot = new Map(team.map((member) => [member.slot_index, member]))

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 shadow-lg">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <PitchLines />
      </svg>

      {layout.map((slot) => {
        const member = teamBySlot.get(slot.index)
        const compatible =
          !member && selectedPlayer !== null && isSlotCompatible(slot.position, selectedPlayer.position)

        return (
          <button
            key={slot.index}
            type="button"
            disabled={disabled || !compatible}
            onClick={() => onSlotClick(slot.index)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {member ? (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950 shadow">
                  {member.rating.toFixed(1)}
                </div>
                <span className="max-w-[4.5rem] truncate rounded bg-slate-950/70 px-1 text-[10px] leading-tight text-slate-100">
                  {member.name}
                </span>
              </>
            ) : (
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-semibold transition ${
                  compatible
                    ? 'animate-pulse border-emerald-400 bg-emerald-400/20 text-emerald-200'
                    : 'border-white/30 text-white/50'
                }`}
              >
                {slot.position}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
