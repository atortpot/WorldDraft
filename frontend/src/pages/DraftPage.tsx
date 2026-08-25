import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, getTeam, passRoll, pickPlayer, rollDraft } from '../api/client'
import { BoxScore } from '../components/BoxScore'
import { Pitch } from '../components/Pitch'
import { useDraft } from '../context/DraftContext'
import { isSlotCompatible } from '../lib/formations'
import type { RollPlayer, RollResult, TeamMember } from '../api/types'

// Debe coincidir con TEAM_SIZE en app/game/draft_service.py.
const TEAM_SIZE = 11

const POSITION_LABELS: Record<string, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Centrocampista',
  FW: 'Delantero',
}

export function DraftPage() {
  const navigate = useNavigate()
  const { sessionId, formation } = useDraft()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [roll, setRoll] = useState<RollResult | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<RollPlayer | null>(null)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [rolling, setRolling] = useState(false)
  const [picking, setPicking] = useState(false)
  const [passing, setPassing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !formation) {
      navigate('/')
      return
    }
    getTeam(sessionId)
      .then(setTeam)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingTeam(false))
  }, [sessionId, formation, navigate])

  if (!sessionId || !formation) return null

  async function handleRoll() {
    setRolling(true)
    setError(null)
    setSelectedPlayer(null)
    try {
      const result = await rollDraft(sessionId!)
      setRoll(result)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRolling(false)
    }
  }

  async function handleSlotClick(slotIndex: number) {
    if (!selectedPlayer) return
    setPicking(true)
    setError(null)
    try {
      await pickPlayer(sessionId!, selectedPlayer.id, slotIndex)
      const updatedTeam = await getTeam(sessionId!)
      setTeam(updatedTeam)
      setRoll(null)
      setSelectedPlayer(null)
      if (updatedTeam.length >= TEAM_SIZE) {
        navigate('/tournament')
      }
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
      await passRoll(sessionId!)
      setRoll(null)
      setSelectedPlayer(null)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPassing(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-50">Arma tu equipo ({formation})</h1>
        <p className="text-sm text-slate-400">
          {team.length} / {TEAM_SIZE} jugadores elegidos
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(team.length / TEAM_SIZE) * 100}%` }}
          />
        </div>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!roll ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-center text-slate-400">
            Lanza una tirada para ver una seleccion y su Mundial, y elige a uno de sus
            jugadores para tu equipo.
          </p>
          <button
            type="button"
            onClick={handleRoll}
            disabled={rolling}
            className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rolling ? 'Tirando...' : '🎲 Tirar de nuevo'}
          </button>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-4 text-center">
            <h2 className="text-xl font-bold text-slate-50">
              🎲 Te ha salido: {roll.country} {roll.tournament_year}
            </h2>
            {selectedPlayer ? (
              <p className="text-sm text-emerald-400">
                Toca un slot iluminado del campo para colocar a{' '}
                <span className="font-semibold">{selectedPlayer.name}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-400">Elige a uno de sus jugadores</p>
            )}
          </div>

          <ul className="flex flex-wrap justify-center gap-2">
            {roll.players.map((player) => {
              const isSelected = selectedPlayer?.id === player.id
              const hasCompatibleSlot = roll.free_slots.some((slot) =>
                isSlotCompatible(slot.position, player.position),
              )
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(player)}
                    disabled={picking || !hasCompatibleSlot}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-100">{player.name}</span>
                    <span className="text-xs text-slate-500">{POSITION_LABELS[player.position]}</span>
                    <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                      {player.rating.toFixed(1)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handlePass}
              disabled={passing || roll.passes_remaining === 0}
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passing
                ? 'Pasando...'
                : `Pasar tirada (quedan ${roll.passes_remaining}/${roll.max_passes})`}
            </button>
          </div>
        </section>
      )}

      {loadingTeam ? (
        <p className="text-center text-slate-400">Cargando equipo...</p>
      ) : (
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:justify-center">
          <div className="w-full max-w-sm">
            <Pitch
              formation={formation}
              team={team}
              selectedPlayer={selectedPlayer}
              onSlotClick={handleSlotClick}
              disabled={picking}
            />
          </div>
          <BoxScore formation={formation} team={team} />
        </div>
      )}
    </div>
  )
}
