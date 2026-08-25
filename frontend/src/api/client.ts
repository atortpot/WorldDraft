import axios from 'axios'
import type { Candidate, SimulationResult, TeamMember } from './types'

// Rutas relativas: el proxy de Vite (vite.config.ts) las reenvia a la API
// FastAPI en http://localhost:8000 durante el desarrollo.
const api = axios.create()

// Sin login todavia (app/auth esta vacio): usamos el usuario de pruebas
// insertado manualmente en la base de datos.
export const TEST_USER_ID = 1

export async function startDraft(): Promise<number> {
  const { data } = await api.post<{ draft_session_id: number }>('/game/draft/start', {
    user_id: TEST_USER_ID,
  })
  return data.draft_session_id
}

export async function getCandidates(sessionId: number, position: string): Promise<Candidate[]> {
  const { data } = await api.get<Candidate[]>(`/game/draft/${sessionId}/candidates`, {
    params: { position },
  })
  return data
}

export async function pickPlayer(
  sessionId: number,
  playerId: number,
  positionSlot: string,
): Promise<void> {
  await api.post(`/game/draft/${sessionId}/pick`, {
    player_id: playerId,
    position_slot: positionSlot,
  })
}

export async function getTeam(sessionId: number): Promise<TeamMember[]> {
  const { data } = await api.get<TeamMember[]>(`/game/draft/${sessionId}/team`)
  return data
}

export async function simulateMatch(sessionId: number): Promise<SimulationResult> {
  const { data } = await api.post<SimulationResult>(`/game/draft/${sessionId}/simulate`)
  return data
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return 'Ha ocurrido un error inesperado. Intentalo de nuevo.'
}
