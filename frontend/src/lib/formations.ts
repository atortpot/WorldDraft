import type { FormationName, PositionAbbreviation, SlotPosition } from '../api/types'

// Debe coincidir con FORMATIONS en app/game/formations.py.
export const FORMATIONS: Record<FormationName, SlotPosition[]> = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
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

const GK_Y = 92
const BACK_LINE_Y = 75
const FRONT_LINE_Y = 12

// Cuantos slots (sin contar el portero) forman cada linea horizontal, de
// defensa a delantera. Por defecto se lee directamente del nombre de la
// formacion ("4-3-2-1" -> [4, 3, 2, 1]), que ya coincide con el orden de los
// slots en FORMATIONS; solo hace falta una entrada aqui cuando el nombre no
// refleja la distribucion visual real, como el rombo de "4-4-2 Diamante"
// (4 defensas, pivote, doble mixto, mediapunta, 2 delanteros: 5 lineas, no
// las 3 que sugiere el nombre).
const ROW_SPLIT_OVERRIDES: Partial<Record<FormationName, number[]>> = {
  '4-4-2 Diamante': [4, 1, 2, 1, 2],
}

function rowSplitFor(formation: FormationName): number[] {
  return ROW_SPLIT_OVERRIDES[formation] ?? formation.split(' ')[0].split('-').map(Number)
}

// Separacion horizontal maxima entre los slots de una fila, segun cuantos
// haya: mas jugadores en la linea, mas se abren hacia las bandas.
function rowWidth(n: number): number {
  if (n <= 1) return 0
  return Math.min(84, 40 + (n - 1) * 16)
}

export function computeLayout(formation: FormationName): SlotLayout[] {
  const [gk, ...outfield] = FORMATIONS[formation]
  const split = rowSplitFor(formation)
  const rowCount = split.length

  const result: SlotLayout[] = [{ index: 0, position: gk, x: 50, y: GK_Y }]

  let cursor = 0
  split.forEach((count, rowIndex) => {
    const items = outfield
      .slice(cursor, cursor + count)
      .map((position, i) => ({ position, index: cursor + 1 + i }))
      .sort((a, b) => LANE_RANK[a.position] - LANE_RANK[b.position])
    cursor += count

    const y =
      rowCount === 1
        ? BACK_LINE_Y
        : BACK_LINE_Y - (rowIndex / (rowCount - 1)) * (BACK_LINE_Y - FRONT_LINE_Y)
    const width = rowWidth(items.length)
    const lo = 50 - width / 2

    items.forEach((item, i) => {
      const x = items.length === 1 ? 50 : lo + (i / (items.length - 1)) * width
      result.push({ index: item.index, position: item.position, x, y })
    })
  })

  return result.sort((a, b) => a.index - b.index)
}
