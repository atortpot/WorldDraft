import type { FormationName, PositionAbbreviation, RollPlayer, TeamMember } from '../api/types'
import { computeLayout, isSlotCompatible } from '../lib/formations'
import { ShirtIcon } from '../lib/icons'
import { PitchLines } from './PitchLines'

interface Props {
  formation: FormationName
  team: TeamMember[]
  selectedPlayer: RollPlayer | null
  onSlotClick: (slotIndex: number) => void
  disabled: boolean
  hideRatings?: boolean
}

export const NATURAL_POSITION_TO_ABBREVIATION: Record<string, PositionAbbreviation> = {
  goalkeeper: 'GK',
  defender: 'DF',
  midfielder: 'MF',
  forward: 'FW',
  GK: 'GK',
  DF: 'DF',
  MF: 'MF',
  FW: 'FW',
}

export const POSITION_STYLES: Record<PositionAbbreviation, { border: string; badge: string; gradient: string }> = {
  FW: {
    border: 'border-emerald-400',
    badge: 'border-emerald-300 bg-emerald-500 text-emerald-950',
    gradient: 'radial-gradient(circle at 32% 26%, #6ee7b7, #059669 70%)',
  },
  MF: {
    border: 'border-sky-400',
    badge: 'border-sky-300 bg-sky-500 text-sky-950',
    gradient: 'radial-gradient(circle at 32% 26%, #7dd3fc, #0284c7 70%)',
  },
  DF: {
    border: 'border-yellow-400',
    badge: 'border-yellow-300 bg-yellow-500 text-yellow-950',
    gradient: 'radial-gradient(circle at 32% 26%, #fde047, #ca8a04 70%)',
  },
  GK: {
    border: 'border-orange-400',
    badge: 'border-orange-300 bg-orange-500 text-orange-950',
    gradient: 'radial-gradient(circle at 32% 26%, #fdba74, #c2410c 70%)',
  },
}

// Nombre completo si cabe; si no, solo el apellido. Si ni el apellido cabe
// en el contenedor, el truncate de CSS del contenedor añade "..." (por eso
// esto no necesita cortar caracteres a mano: el contenedor con `truncate`
// es la ultima red de seguridad).
export function displayName(fullName: string): string {
  if (fullName.length <= 13) return fullName
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1]
}

export function Pitch({ formation, team, selectedPlayer, onSlotClick, disabled, hideRatings }: Props) {
  const layout = computeLayout(formation)
  const teamBySlot = new Map(team.map((member) => [member.slot_index, member]))

  return (
    <div className="relative aspect-[3/5] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <PitchLines />
      </svg>

      {layout.map((slot) => {
        const member = teamBySlot.get(slot.index)
        const memberAbbreviation = member
          ? (NATURAL_POSITION_TO_ABBREVIATION[member.position] ?? 'MF')
          : null
        const compatible =
          !member && selectedPlayer !== null && isSlotCompatible(slot.position, selectedPlayer.position)
        const style = memberAbbreviation ? POSITION_STYLES[memberAbbreviation] : null

        return (
          <button
            key={slot.index}
            type="button"
            disabled={disabled || !compatible}
            onClick={() => onSlotClick(slot.index)}
            className="group/player absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {member && style ? (
              <>
                <div className="relative animate-card-pop">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg ${style.border}`}
                    style={{ background: style.gradient }}
                  >
                    <ShirtIcon className="h-5 w-5 text-white/40" />
                  </div>
                  {!hideRatings && (
                    <span
                      className={`absolute -bottom-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border px-1 text-[9px] font-bold shadow ${style.badge}`}
                    >
                      {member.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <span className="max-w-[4.5rem] truncate rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-slate-100">
                  {displayName(member.name)}
                </span>

                {/* Tooltip: nombre completo, pais, año, rating */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[11rem] -translate-x-1/2 scale-95 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-center opacity-0 shadow-xl transition-all duration-150 group-hover/player:scale-100 group-hover/player:opacity-100">
                  <p className="text-[11px] font-semibold text-slate-50">{member.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {member.country} · {member.tournament_year}
                  </p>
                  <p className="text-[10px] font-medium text-emerald-300">Rating {member.rating.toFixed(1)}</p>
                </div>
              </>
            ) : (
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold transition-all duration-200 ${
                  compatible
                    ? 'animate-slot-pulse border-emerald-400 bg-emerald-400/25 text-emerald-100'
                    : 'border-white/25 bg-white/[0.03] text-white/40'
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
