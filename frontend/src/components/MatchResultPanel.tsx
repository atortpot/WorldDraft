import type { SimulationResult } from '../api/types'

const RESULT_LABEL: Record<string, string> = {
  win: 'Victoria',
  draw: 'Empate',
  loss: 'Derrota',
}

const RESULT_COLOR: Record<string, string> = {
  win: 'text-emerald-400',
  draw: 'text-amber-400',
  loss: 'text-red-400',
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

// La fase de grupos son 3 partidos seguidos (group_1/2/3): ganar o empatar
// cualquiera de ellos no es "avanzar de ronda" salvo que sea el ultimo, que
// es cuando de verdad se pasa a octavos. Perder en cualquiera de los tres
// elimina igual que en eliminatorias.
function outcomeLabel(result: SimulationResult): string {
  if (!result.advanced) return 'Quedas eliminado'
  if (result.round === 'group_1' || result.round === 'group_2') {
    return 'Partido de fase de grupos finalizado'
  }
  if (result.round === 'group_3') return 'Superas la fase de grupos: a octavos de final'
  if (result.next_round === 'champion') return 'Eres campeon del mundo'
  return 'Avanzas de ronda'
}

interface Props {
  result: SimulationResult
  onNext: () => void
}

export function MatchResultPanel({ result, onNext }: Props) {
  const label = outcomeLabel(result)
  const outcomeColor = result.advanced ? 'text-emerald-400' : 'text-red-400'
  const isHighChemistry = result.chemistry.total_bonus >= 0.1

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Rival: {result.opponent.country} · Mundial {result.opponent.tournament_year}
        </p>
        <h2 className={`text-4xl font-extrabold tracking-tight ${RESULT_COLOR[result.result]}`}>
          {RESULT_LABEL[result.result] ?? result.result}
        </h2>
        {result.penalties?.took_place && (
          <p className="text-sm text-slate-400">
            Empate en el tiempo reglamentario, resuelto en la tanda de penaltis.
          </p>
        )}
        <p className={`text-sm font-bold ${outcomeColor}`}>{label}</p>
      </header>

      <section
        className={`glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center ${
          isHighChemistry ? 'border-amber-400/40 shadow-lg shadow-amber-950/30' : ''
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Quimica de equipo</p>
        {result.chemistry.total_bonus > 0 ? (
          <>
            <p
              className={`text-3xl font-extrabold ${isHighChemistry ? 'text-amber-400' : 'text-emerald-400'}`}
            >
              +{Math.round(result.chemistry.total_bonus * 100)}% rating
            </p>
            <p className="text-sm text-slate-400">
              {[
                result.chemistry.chemistry_details.nation &&
                  `${result.chemistry.chemistry_details.nation.count} jugadores de ${result.chemistry.chemistry_details.nation.country} (+${Math.round(result.chemistry.chemistry_details.nation.bonus * 100)}%)`,
                result.chemistry.chemistry_details.era &&
                  `${result.chemistry.chemistry_details.era.count} jugadores de los ${result.chemistry.chemistry_details.era.era} (+${Math.round(result.chemistry.chemistry_details.era.bonus * 100)}%)`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Sin bonificacion de quimica en este equipo.</p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-4 text-center">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Victoria</p>
          <p className="text-2xl font-extrabold text-emerald-400">{formatPercent(result.win)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Empate</p>
          <p className="text-2xl font-extrabold text-amber-400">{formatPercent(result.draw)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Derrota</p>
          <p className="text-2xl font-extrabold text-red-400">{formatPercent(result.loss)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-200">Que inclino el partido</h3>
        {result.explanation.length === 0 ? (
          <p className="text-sm text-slate-500">
            El modelo actual no permite desglosar esta prediccion en factores individuales.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.explanation.map((item) => (
              <li
                key={item.feature}
                className="glass-card flex items-center justify-between rounded-xl px-4 py-3"
              >
                <span className="text-sm text-slate-300">{item.label}</span>
                <span
                  className={`text-sm font-semibold ${item.favors === 'team_a' ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {item.favors === 'team_a' ? 'a tu favor' : 'a favor del rival'} ·{' '}
                  {Math.abs(item.weight).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-8 py-3.5 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
        >
          {result.tournament_finished ? 'Ver resultado final' : 'Siguiente partido'}
        </button>
      </div>
    </div>
  )
}
