import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  abandonDraft,
  apiErrorMessage,
  getTeam,
  passRoll,
  pickPlayer,
  rollDraft,
} from '../api/client'
import { AppHeader } from '../components/AppHeader'
import { BoxScore } from '../components/BoxScore'
import { ChemistryPanel } from '../components/ChemistryPanel'
import { Pitch } from '../components/Pitch'
import { useDraft } from '../context/DraftContext'
import { isSlotCompatible } from '../lib/formations'
import { CheckIcon, DiamondIcon, DiceIcon, HexagonIcon, ShieldIcon, TriangleIcon } from '../lib/icons'
import type { PositionAbbreviation, RollPlayer, RollResult, TeamMember } from '../api/types'

// Debe coincidir con TEAM_SIZE en app/game/draft_service.py.
const TEAM_SIZE = 11

// Duracion del fundido de salida de la tirada actual antes de sustituirla
// por la siguiente (ver runRollTransition). Debe coincidir con la duracion
// de la animacion .animate-roll-out en index.css.
const ROLL_EXIT_MS = 180
// Retraso antes de que una tirjeta seleccionada active el pulso de los slots
// compatibles en el campo, para que primero se note la seleccion en la
// propia tarjeta.
const SLOT_PULSE_DELAY_MS = 160
// Fundido de salida del draft completo antes de navegar al torneo.
const PAGE_EXIT_MS = 200

const POSITION_GROUPS: {
  code: PositionAbbreviation
  label: string
  Icon: typeof DiamondIcon
  accent: string
  chip: string
}[] = [
  { code: 'GK', label: 'Porteros', Icon: DiamondIcon, accent: 'text-orange-400', chip: 'bg-orange-400' },
  { code: 'DF', label: 'Defensas', Icon: ShieldIcon, accent: 'text-yellow-400', chip: 'bg-yellow-400' },
  { code: 'MF', label: 'Centrocampistas', Icon: HexagonIcon, accent: 'text-sky-400', chip: 'bg-sky-400' },
  { code: 'FW', label: 'Delanteros', Icon: TriangleIcon, accent: 'text-emerald-400', chip: 'bg-emerald-400' },
]

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// 'idle': todavia no se ha lanzado ninguna tirada. 'active': hay una tirada
// con jugadores para elegir. 'placed': se acaba de colocar un jugador y se
// espera a que el usuario pida la siguiente tirada explicitamente.
type RollPhase = 'idle' | 'active' | 'placed'

export function DraftPage() {
  const navigate = useNavigate()
  const { sessionId, formation, mode, reset } = useDraft()
  const hideRatings = mode === 'almanac'

  const [team, setTeam] = useState<TeamMember[]>([])
  const [roll, setRoll] = useState<RollResult | null>(null)
  const [phase, setPhase] = useState<RollPhase>('idle')
  const [placedPlayerName, setPlacedPlayerName] = useState<string | null>(null)
  const [rollKey, setRollKey] = useState(0)
  const [rollExiting, setRollExiting] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<RollPlayer | null>(null)
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<number | null>(null)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [rolling, setRolling] = useState(false)
  const [picking, setPicking] = useState(false)
  const [passing, setPassing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abandoned, setAbandoned] = useState(false)
  const selectTimeoutRef = useRef<number | null>(null)
  // Punto de referencia estable (el bloque del campo, siempre debajo de la
  // zona de tirada) usado para compensar el scroll: ver markScrollPreserve.
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const scrollAnchorTopRef = useRef<number | null>(null)

  // La zona de tirada cambia de contenido (lista de jugadores <-> aviso de
  // "jugador colocado" <-> lista siguiente) con alturas muy distintas entre
  // si. Sin esto, el navegador deja el scrollY tal cual tras el cambio de
  // altura del DOM, lo que desplaza visualmente todo lo que hay debajo (el
  // campo, la quimica de equipo...), dando la sensacion de que la pagina ha
  // hecho scroll sola. markScrollPreserve() guarda la posicion en pantalla
  // del campo justo antes de una actualizacion que pueda cambiar esa altura;
  // este efecto, que corre en cuanto el DOM se actualiza y antes de que el
  // navegador pinte el frame, ajusta el scroll lo que haga falta para que el
  // campo quede exactamente en el mismo sitio en el que estaba, sin importar
  // si el usuario tenia la vista puesta encima, debajo o dentro de la zona
  // de tirada que cambio de tamaño (una simple diferencia de scrollHeight
  // del documento no vale: solo es correcta cuando la vista esta por debajo
  // del bloque que cambia de altura).
  useLayoutEffect(() => {
    const topBefore = scrollAnchorTopRef.current
    if (topBefore === null) return
    scrollAnchorTopRef.current = null
    const topAfter = scrollAnchorRef.current?.getBoundingClientRect().top
    if (topAfter === undefined) return
    const diff = topAfter - topBefore
    if (diff !== 0) window.scrollTo(window.scrollX, window.scrollY + diff)
  })

  function markScrollPreserve() {
    scrollAnchorTopRef.current = scrollAnchorRef.current?.getBoundingClientRect().top ?? null
  }

  useEffect(() => {
    // Se salta esta guarda cuando el propio abandono acaba de vaciar
    // sessionId/formation via reset(): sin esto, este efecto competiria por
    // la navegacion con el navigate('/formation') de handleAbandonConfirmed
    // y a veces ganaba, dejando al usuario en Home en vez de en Formacion.
    if (abandoned) return
    if (!sessionId || !formation) {
      navigate('/')
      return
    }
    getTeam(sessionId)
      .then(setTeam)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingTeam(false))
  }, [sessionId, formation, navigate, abandoned])

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) window.clearTimeout(selectTimeoutRef.current)
    }
  }, [])

  if (!sessionId || !formation) return null

  function clearSelection() {
    if (selectTimeoutRef.current) window.clearTimeout(selectTimeoutRef.current)
    setSelectedPlayer(null)
    setHighlightedPlayerId(null)
  }

  // Anima la salida del contenido actual de la zona de tirada (la lista de
  // jugadores o el aviso de "jugador colocado", segun la fase), ejecuta
  // `loadNext` en paralelo (que debe devolver la nueva tirada) y solo
  // entonces la muestra con su propia animacion de entrada. La usan tanto
  // "Pasar tirada" como "Tirar de nuevo" tras colocar a alguien.
  async function runRollTransition(loadNext: () => Promise<RollResult>) {
    setRollExiting(true)
    try {
      const [next] = await Promise.all([loadNext(), wait(ROLL_EXIT_MS)])
      markScrollPreserve()
      clearSelection()
      setRoll(next)
      setPhase('active')
      setRollKey((key) => key + 1)
    } finally {
      setRollExiting(false)
    }
  }

  function handleSelectPlayer(player: RollPlayer) {
    if (picking) return
    clearSelection()
    setHighlightedPlayerId(player.id)
    selectTimeoutRef.current = window.setTimeout(() => {
      setSelectedPlayer(player)
    }, SLOT_PULSE_DELAY_MS)
  }

  // Primera tirada de la sesion: todavia no hay nada que fundir en salida,
  // asi que no pasa por runRollTransition.
  async function handleRoll() {
    setRolling(true)
    setError(null)
    clearSelection()
    try {
      const result = await rollDraft(sessionId!)
      markScrollPreserve()
      setRoll(result)
      setPhase('active')
      setRollKey((key) => key + 1)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRolling(false)
    }
  }

  // El usuario pide explicitamente la siguiente tirada tras colocar a
  // alguien (boton "Tirar de nuevo" en la fase 'placed').
  async function handleRollAgain() {
    setRolling(true)
    setError(null)
    try {
      await runRollTransition(() => rollDraft(sessionId!))
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRolling(false)
    }
  }

  async function handleSlotClick(slotIndex: number) {
    if (!selectedPlayer) return
    const pickedPlayerName = selectedPlayer.name
    setPicking(true)
    setError(null)
    try {
      await pickPlayer(sessionId!, selectedPlayer.id, slotIndex)
      const updatedTeam = await getTeam(sessionId!)
      setTeam(updatedTeam)
      clearSelection()

      if (updatedTeam.length >= TEAM_SIZE) {
        setLeaving(true)
        await wait(PAGE_EXIT_MS)
        navigate('/tournament')
        return
      }

      // No se carga la siguiente tirada automaticamente: se muestra el
      // aviso de "jugador colocado" y se espera a que el usuario pida otra
      // con "Tirar de nuevo" (ver handleRollAgain).
      markScrollPreserve()
      setRoll(null)
      setPlacedPlayerName(pickedPlayerName)
      setPhase('placed')
      setRollKey((key) => key + 1)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPicking(false)
    }
  }

  async function handlePass() {
    setPassing(true)
    setError(null)
    try {
      await runRollTransition(async () => {
        await passRoll(sessionId!)
        return rollDraft(sessionId!)
      })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPassing(false)
    }
  }

  async function handleAbandonConfirmed() {
    setAbandoning(true)
    setError(null)
    try {
      await abandonDraft(sessionId!)
      setAbandoned(true)
      reset()
      navigate('/formation')
    } catch (err) {
      setError(apiErrorMessage(err))
      setAbandoning(false)
      setShowAbandonConfirm(false)
    }
  }

  return (
    <div
      className={`mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-6 ${
        leaving ? 'animate-page-out' : 'animate-page-in'
      }`}
    >
      <AppHeader />

      <header className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
            Arma tu equipo <span className="text-slate-500">({formation})</span>
          </h1>
          <button
            type="button"
            onClick={() => setShowAbandonConfirm(true)}
            className="shrink-0 pt-1.5 text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-red-400"
          >
            Abandonar draft
          </button>
        </div>
        <p className="text-sm font-medium text-slate-400">
          {team.length} / {TEAM_SIZE} jugadores elegidos
        </p>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)] transition-all duration-500"
            style={{ width: `${(team.length / TEAM_SIZE) * 100}%` }}
          />
        </div>
      </header>

      {error && <p className="text-sm font-medium text-red-400">{error}</p>}

      {phase === 'idle' ? (
        <div className="glass-card flex flex-col items-center gap-4 rounded-2xl py-10 text-center">
          <p className="max-w-md text-slate-400">
            Lanza una tirada para ver una seleccion y su Mundial, y elige a uno de sus
            jugadores para tu equipo.
          </p>
          <button
            type="button"
            onClick={handleRoll}
            disabled={rolling}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 py-3 font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DiceIcon className="h-5 w-5" />
            {rolling ? 'Tirando...' : 'Tirar de nuevo'}
          </button>
        </div>
      ) : (
        <section
          key={rollKey}
          className={`flex flex-col gap-5 ${rollExiting ? 'animate-roll-out' : 'animate-roll-in'}`}
        >
          {phase === 'placed' ? (
            <div className="glass-card flex flex-col items-center gap-4 rounded-2xl py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">
                <CheckIcon className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="max-w-md text-slate-300">
                Has fichado a <span className="font-bold text-emerald-400">{placedPlayerName}</span>.
                Lanza otra tirada para seguir completando tu equipo.
              </p>
              <button
                type="button"
                onClick={handleRollAgain}
                disabled={rolling}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 py-3 font-bold text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                <DiceIcon className="h-5 w-5" />
                {rolling ? 'Tirando...' : 'Tirar de nuevo'}
              </button>
            </div>
          ) : (
            roll && (
              <>
                <div className="glass-card flex flex-col items-center gap-2 rounded-2xl py-5 text-center">
                  <h2 className="flex items-center gap-2 text-2xl font-extrabold text-slate-50">
                    <DiceIcon className="h-6 w-6 text-emerald-400" />
                    Te ha salido: {roll.country} {roll.tournament_year}
                  </h2>
                  {selectedPlayer ? (
                    <p className="text-sm font-medium text-emerald-400">
                      Toca un slot iluminado del campo para colocar a{' '}
                      <span className="font-bold">{selectedPlayer.name}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">Elige a uno de sus jugadores</p>
                  )}
                </div>

                <div className="flex flex-col gap-5">
                  {POSITION_GROUPS.map((group) => {
                    const players = roll.players.filter((player) => player.position === group.code)
                    if (players.length === 0) return null

                    return (
                      <div key={group.code} className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <group.Icon className={`h-4 w-4 ${group.accent}`} />
                          <h3 className={`text-xs font-bold uppercase tracking-[0.15em] ${group.accent}`}>
                            {group.label}
                          </h3>
                          <span className={`h-px flex-1 bg-gradient-to-r from-current to-transparent ${group.accent} opacity-30`} />
                        </div>

                        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {players.map((player) => {
                            const isSelected = highlightedPlayerId === player.id
                            const hasCompatibleSlot = roll.free_slots.some((slot) =>
                              isSlotCompatible(slot.position, player.position),
                            )
                            return (
                              <li key={player.id}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectPlayer(player)}
                                  disabled={picking || !hasCompatibleSlot}
                                  className={`glass-card flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
                                    isSelected
                                      ? 'border-emerald-400/70 bg-emerald-500/10 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-400/40'
                                      : 'hover:-translate-y-0.5 hover:border-slate-600'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${group.chip}`} />
                                    <span className="truncate text-sm font-semibold text-slate-100">
                                      {player.name}
                                    </span>
                                  </span>
                                  {!hideRatings && (
                                    <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-emerald-400">
                                      {player.rating.toFixed(1)}
                                    </span>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handlePass}
                    disabled={passing || roll.passes_remaining === 0}
                    className="rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3 font-semibold text-slate-200 shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {passing
                      ? 'Pasando...'
                      : `Pasar tirada (quedan ${roll.passes_remaining}/${roll.max_passes})`}
                  </button>
                </div>
              </>
            )
          )}
        </section>
      )}

      {loadingTeam ? (
        <p className="text-center text-slate-400">Cargando equipo...</p>
      ) : (
        <>
          <div ref={scrollAnchorRef} className="flex flex-col items-start gap-6 sm:flex-row sm:justify-center">
            <div className="w-full max-w-sm">
              <Pitch
                formation={formation}
                team={team}
                selectedPlayer={selectedPlayer}
                onSlotClick={handleSlotClick}
                disabled={picking}
                hideRatings={hideRatings}
              />
            </div>
            <BoxScore formation={formation} team={team} hideRatings={hideRatings} />
          </div>
          <ChemistryPanel team={team} />
        </>
      )}

      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm rounded-2xl p-6 text-center">
            <p className="text-lg font-bold text-slate-50">Seguro que quieres abandonar?</p>
            <p className="mt-2 text-sm text-slate-400">Perderas el progreso actual.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowAbandonConfirm(false)}
                disabled={abandoning}
                className="rounded-xl border border-slate-700 px-5 py-2.5 font-semibold text-slate-200 transition-all duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAbandonConfirmed}
                disabled={abandoning}
                className="rounded-xl bg-gradient-to-b from-red-500 to-red-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-red-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {abandoning ? 'Abandonando...' : 'Abandonar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
