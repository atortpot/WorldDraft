import type { FormationName, TeamMember } from '../api/types'
import { computeLayout } from '../lib/formations'
import { ShirtIcon } from '../lib/icons'
import { NATURAL_POSITION_TO_ABBREVIATION, POSITION_STYLES, displayName } from './Pitch'
import { PitchLines } from './PitchLines'

interface Props {
  formation: FormationName
  team: TeamMember[]
  hideRatings?: boolean
}

// Vista estatica y compacta del equipo propio en su formacion, para verla de
// un vistazo durante el partido (animacion + resultado) sin competir en
// tamaño con el marcador ni el feed de eventos. A diferencia de Pitch, no es
// interactiva (no hay slots vacios que rellenar: el equipo ya esta completo
// para cuando se juega un partido) ni anima la entrada de jugadores.
export function MatchPitch({ formation, team, hideRatings }: Props) {
  const layout = computeLayout(formation)
  const teamBySlot = new Map(team.map((member) => [member.slot_index, member]))

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 shadow-lg">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <PitchLines />
      </svg>

      {layout.map((slot) => {
        const member = teamBySlot.get(slot.index)
        if (!member) return null
        const abbreviation = NATURAL_POSITION_TO_ABBREVIATION[member.position] ?? 'MF'
        const style = POSITION_STYLES[abbreviation]

        return (
          <div
            key={slot.index}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <div className="relative">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border shadow ${style.border}`}
                style={{ background: style.gradient }}
              >
                <ShirtIcon className="h-3 w-3 text-white/40" />
              </div>
              {!hideRatings && (
                <span
                  className={`absolute -bottom-1 -right-1 flex h-3.5 min-w-[0.95rem] items-center justify-center rounded-full border px-0.5 text-[7px] font-bold ${style.badge}`}
                >
                  {member.rating.toFixed(1)}
                </span>
              )}
            </div>
            <span className="max-w-[3.4rem] truncate rounded bg-slate-950/80 px-1 py-0.5 text-[8px] font-medium leading-tight text-slate-100">
              {displayName(member.name)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
