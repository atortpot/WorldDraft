import { CheckIcon, CrossIcon } from '../lib/icons'
import type { GroupTable, GroupTeamRow } from '../api/types'

interface Props {
  table: GroupTable
}

function teamLabel(team: GroupTeamRow): string {
  if (team.is_user) return 'Tu equipo'
  return `${team.country} ${team.tournament_year}`
}

function formatGoalDiff(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

// Tabla de grupo en tiempo real: 4 equipos (el propio + 3 rivales
// historicos), PJ/Pts/DG, ya ordenada de 1o a 4o por el backend. Cuando el
// grupo termina (tras el 3er partido) añade la columna de clasificacion
// con un check/cruz y atenua a los eliminados, para que quede claro quien
// pasa a octavos antes de continuar.
export function GroupStandingsTable({ table }: Props) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <th className="px-4 py-2.5">Equipo</th>
              <th className="px-2 py-2.5 text-center">PJ</th>
              <th className="px-2 py-2.5 text-center">Pts</th>
              <th className="px-2 py-2.5 text-center">DG</th>
              {table.group_complete && <th className="px-3 py-2.5 text-center">​</th>}
            </tr>
          </thead>
          <tbody>
            {table.teams.map((team) => {
              const isEliminatedByTable = table.group_complete && team.qualified === false
              return (
                <tr
                  key={team.is_user ? 'user' : `${team.country}-${team.tournament_year}`}
                  className={`border-b border-white/5 last:border-0 ${
                    team.is_user ? 'bg-emerald-500/10' : ''
                  } ${isEliminatedByTable ? 'opacity-45' : ''}`}
                >
                  <td className={`px-4 py-2.5 font-semibold ${team.is_user ? 'text-emerald-300' : 'text-slate-100'}`}>
                    {teamLabel(team)}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-400">{team.played}</td>
                  <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-100">{team.points}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-400">
                    {formatGoalDiff(team.goal_diff)}
                  </td>
                  {table.group_complete && (
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        {team.qualified ? (
                          <CheckIcon className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <CrossIcon className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
        {table.group_complete
          ? 'Clasifican a octavos los 2 primeros del grupo.'
          : 'Los 2 primeros tras los 3 partidos clasifican a octavos.'}
      </p>

      {table.group_complete && table.other_matches.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Otros resultados del grupo
          </p>
          <ul className="flex flex-col gap-1 text-sm text-slate-300">
            {table.other_matches.map((match, index) => (
              <li key={index}>
                {match.home.country} {match.home.tournament_year} {match.home_goals}-{match.away_goals}{' '}
                {match.away.country} {match.away.tournament_year}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
