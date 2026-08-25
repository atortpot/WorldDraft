import type { FormationName } from '../api/types'
import { computeLayout } from '../lib/formations'
import { PitchLines } from './PitchLines'

interface Props {
  formation: FormationName
}

export function FormationThumbnail({ formation }: Props) {
  const layout = computeLayout(formation)

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full rounded-md">
      <PitchLines />
      {layout.map((slot) => (
        <circle key={slot.index} cx={slot.x} cy={slot.y} r={3.2} fill="#34d399" />
      ))}
    </svg>
  )
}
