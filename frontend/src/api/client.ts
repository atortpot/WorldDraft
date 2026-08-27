import axios from 'axios'
import type {
  ActiveDraftSession,
  FormationName,
  MeResponse,
  PassResult,
  RollResult,
  SimulationResult,
  TeamMember,
} from './types'

// Rutas relativas: el proxy de Vite (vite.config.ts) las reenvia a la API
// FastAPI en http://localhost:8000 durante el desarrollo.
// withCredentials: true para que el navegador mande la cookie httpOnly de
// sesion (worlddraftauth) en cada peticion -- la persistencia de sesion
// depende enteramente de esa cookie, el frontend ya no gestiona ningun
// token en memoria ni cabecera Authorization.
const api = axios.create({ withCredentials: true })

export async function register(email: string, password: string): Promise<void> {
  await api.post('/auth/register', { email, password })
}

export async function cookieLogin(email: string, password: string): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>('/auth/cookie/login', { email, password })
  return data
}

export async function cookieLogout(): Promise<void> {
  await api.post('/auth/cookie/logout')
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me')
  return data
}

export async function startDraft(formation: FormationName): Promise<number> {
  const { data } = await api.post<{ draft_session_id: number }>('/game/draft/start', { formation })
  return data.draft_session_id
}

export async function getActiveDraft(): Promise<ActiveDraftSession | null> {
  const { data } = await api.get<ActiveDraftSession | null>('/game/draft/active')
  return data
}

export async function rollDraft(sessionId: number): Promise<RollResult> {
  const { data } = await api.get<RollResult>(`/game/draft/${sessionId}/roll`)
  return data
}

export async function passRoll(sessionId: number): Promise<PassResult> {
  const { data } = await api.post<PassResult>(`/game/draft/${sessionId}/pass`)
  return data
}

export async function pickPlayer(sessionId: number, playerId: number, slotIndex: number): Promise<void> {
  await api.post(`/game/draft/${sessionId}/pick`, {
    player_id: playerId,
    slot_index: slotIndex,
  })
}

export async function abandonDraft(sessionId: number): Promise<void> {
  await api.post(`/game/draft/${sessionId}/abandon`)
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
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  }
  return 'Ha ocurrido un error inesperado. Intentalo de nuevo.'
}
