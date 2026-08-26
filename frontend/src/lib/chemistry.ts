import type { TeamMember } from '../api/types'

// Debe coincidir con NATION_CHEMISTRY_TIERS en app/game/draft_service.py.
const NATION_CHEMISTRY_TIERS: { threshold: number; bonus: number }[] = [
  { threshold: 7, bonus: 0.15 },
  { threshold: 5, bonus: 0.1 },
  { threshold: 3, bonus: 0.05 },
]

// Debe coincidir con DECADE_BY_YEAR en app/game/draft_service.py. No son
// decadas de calendario reales: es la agrupacion propia del sistema de
// quimica.
const DECADE_BY_YEAR: Record<number, string> = {
  1994: '1990s',
  1998: '1990s',
  2002: '2000s',
  2006: '2000s',
  2010: '2000s',
  2014: '2010s',
  2018: '2010s',
  2022: '2020s',
  2026: '2020s',
}
const ERA_ORDER = ['1990s', '2000s', '2010s', '2020s'] as const
const ERA_CHEMISTRY_THRESHOLD = 4
const ERA_CHEMISTRY_BONUS = 0.05

export interface NationTally {
  country: string
  count: number
  bonus: number
  active: boolean
}

export interface EraTally {
  era: string
  count: number
  bonus: number
  active: boolean
}

export interface LiveChemistry {
  nationTallies: NationTally[]
  eraTallies: EraTally[]
  nationBonus: number
  eraBonus: number
  totalBonus: number
}

function bonusForNationCount(count: number): number {
  for (const tier of NATION_CHEMISTRY_TIERS) {
    if (count >= tier.threshold) return tier.bonus
  }
  return 0
}

export function computeLiveChemistry(team: TeamMember[]): LiveChemistry {
  const nationCounts = new Map<string, number>()
  for (const member of team) {
    nationCounts.set(member.country, (nationCounts.get(member.country) ?? 0) + 1)
  }
  const nationTallies: NationTally[] = [...nationCounts.entries()]
    .map(([country, count]) => {
      const bonus = bonusForNationCount(count)
      return { country, count, bonus, active: bonus > 0 }
    })
    .sort((a, b) => b.count - a.count)

  const eraCounts = new Map<string, number>(ERA_ORDER.map((era) => [era, 0]))
  for (const member of team) {
    const era = DECADE_BY_YEAR[member.tournament_year]
    if (era) eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1)
  }
  const eraTallies: EraTally[] = ERA_ORDER.map((era) => {
    const count = eraCounts.get(era) ?? 0
    const active = count >= ERA_CHEMISTRY_THRESHOLD
    return { era, count, bonus: active ? ERA_CHEMISTRY_BONUS : 0, active }
  })

  const nationBonus = nationTallies[0]?.bonus ?? 0
  const eraBonus = eraTallies.find((e) => e.active)?.bonus ?? 0

  return {
    nationTallies,
    eraTallies,
    nationBonus,
    eraBonus,
    totalBonus: Math.round((nationBonus + eraBonus) * 100) / 100,
  }
}
