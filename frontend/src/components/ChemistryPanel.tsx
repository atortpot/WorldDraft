import { computeLiveChemistry } from '../lib/chemistry'
import { SparkleIcon } from '../lib/icons'
import type { TeamMember } from '../api/types'

interface Props {
  team: TeamMember[]
}

export function ChemistryPanel({ team }: Props) {
  const chemistry = computeLiveChemistry(team)
  const topNations = chemistry.nationTallies.filter((n) => n.count > 1).slice(0, 6)
  const isHigh = chemistry.totalBonus >= 0.1

  return (
    <div
      className={`glass-card flex w-full flex-col gap-3 rounded-2xl p-4 transition-colors ${
        isHigh ? 'border-amber-400/40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Quimica de equipo
        </h3>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
            isHigh
              ? 'bg-amber-400/15 text-amber-300'
              : chemistry.totalBonus > 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-slate-800 text-slate-500'
          }`}
        >
          {isHigh && <SparkleIcon className="h-3 w-3" />}+{Math.round(chemistry.totalBonus * 100)}% rating
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-slate-500">Seleccion (3 = +5% · 5 = +10% · 7 = +15%)</p>
        {topNations.length === 0 ? (
          <p className="text-xs text-slate-600">Aun no repites selecciones.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topNations.map((nation) => (
              <span
                key={nation.country}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  nation.active
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {nation.country} · {nation.count}
                {nation.active && ` (+${Math.round(nation.bonus * 100)}%)`}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-slate-500">Epoca (4+ = +5%)</p>
        <div className="flex flex-wrap gap-1.5">
          {chemistry.eraTallies.map((era) => (
            <span
              key={era.era}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                era.active
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {era.era} · {era.count}
              {era.active && ` (+${Math.round(era.bonus * 100)}%)`}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
