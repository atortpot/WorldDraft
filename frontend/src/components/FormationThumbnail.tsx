import type { FormationName, SlotPosition } from '../api/types'
import { computeLayout } from '../lib/formations'
import { PitchLines } from './PitchLines'

interface Props {
  formation: FormationName
}

const SLOT_COLOR: Record<SlotPosition, string> = {
  GK: '#fb923c',
  CB: '#facc15',
  LB: '#facc15',
  RB: '#facc15',
  LWB: '#facc15',
  RWB: '#facc15',
  CDM: '#38bdf8',
  CM: '#38bdf8',
  CAM: '#38bdf8',
  LM: '#38bdf8',
  RM: '#38bdf8',
  ST: '#34d399',
  LW: '#34d399',
  RW: '#34d399',
}

export function FormationThumbnail({ formation }: Props) {
  const layout = computeLayout(formation)

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full rounded-md">
      <PitchLines />
      {layout.map((slot) => (
        <circle
          key={slot.index}
          cx={slot.x}
          cy={slot.y}
          r={3.4}
          fill={SLOT_COLOR[slot.position]}
          stroke="rgba(3,7,18,0.6)"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  )
}
