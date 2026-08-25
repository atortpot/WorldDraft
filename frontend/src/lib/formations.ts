import type { FormationName, PositionAbbreviation, SlotPosition } from '../api/types'

// Debe coincidir con FORMATIONS en app/game/formations.py.
export const FORMATIONS: Record<FormationName, SlotPosition[]> = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'RW'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-3-2-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'CAM', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'CM', 'CDM', 'RM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LM', 'CAM', 'RM', 'ST'],
  '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
  '5-3-2': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'],
  '5-4-1': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'LM', 'CM', 'CM', 'RM', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST'],
  '4-4-2 Diamante': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'CAM', 'CAM', 'ST'],
}

export const FORMATION_NAMES = Object.keys(FORMATIONS) as FormationName[]

// Debe coincidir con SLOT_COMPATIBILITY en app/game/formations.py.
export const SLOT_COMPATIBILITY: Record<SlotPosition, PositionAbbreviation[]> = {
  GK: ['GK'],
  CB: ['DF'],
  LB: ['DF'],
  RB: ['DF'],
  LWB: ['DF'],
  RWB: ['DF'],
  CDM: ['MF'],
  CM: ['MF'],
  LM: ['MF'],
  RM: ['MF'],
  CAM: ['MF', 'FW'],
  ST: ['FW'],
  LW: ['FW'],
  RW: ['FW'],
}

export function isSlotCompatible(slot: SlotPosition, playerPosition: PositionAbbreviation): boolean {
  return SLOT_COMPATIBILITY[slot].includes(playerPosition)
}

export interface SlotLayout {
  index: number
  position: SlotPosition
  x: number
  y: number
}

interface RowDef {
  y: number
  width: number
  positions: SlotPosition[]
}

// De porteria (abajo, y alto) a delantera (arriba, y bajo). El ancho de
// cada fila es la separacion horizontal maxima entre sus slots, no una
// coordenada por posicion: asi el layout se calcula segun que slots trae
// cada formacion, en vez de tener coordenadas fijas por formacion.
const ROWS: RowDef[] = [
  { y: 92, width: 0, positions: ['GK'] },
  { y: 75, width: 76, positions: ['LB', 'CB', 'RB', 'LWB', 'RWB'] },
  { y: 58, width: 50, positions: ['CDM'] },
  { y: 44, width: 62, positions: ['CM'] },
  { y: 30, width: 70, positions: ['LM', 'RM', 'CAM'] },
  { y: 12, width: 60, positions: ['LW', 'ST', 'RW'] },
]

// Dentro de una fila, ordena los slots de izquierda a derecha.
const LANE_RANK: Record<SlotPosition, number> = {
  LB: 0,
  LWB: 0,
  LM: 0,
  LW: 0,
  GK: 1,
  CB: 1,
  CDM: 1,
  CM: 1,
  CAM: 1,
  ST: 1,
  RB: 2,
  RWB: 2,
  RM: 2,
  RW: 2,
}

export function computeLayout(formation: FormationName): SlotLayout[] {
  const slots = FORMATIONS[formation]
  const result: SlotLayout[] = []

  for (const row of ROWS) {
    const items = slots
      .map((position, index) => ({ position, index }))
      .filter(({ position }) => row.positions.includes(position))
      .sort((a, b) => LANE_RANK[a.position] - LANE_RANK[b.position])

    const n = items.length
    if (n === 0) continue

    const lo = 50 - row.width / 2
    items.forEach((item, i) => {
      const x = n === 1 ? 50 : lo + (i / (n - 1)) * row.width
      result.push({ index: item.index, position: item.position, x, y: row.y })
    })
  }

  return result.sort((a, b) => a.index - b.index)
}
