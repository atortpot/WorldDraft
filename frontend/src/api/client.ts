import axios from 'axios'
import type {
  FormationName,
  MeResponse,
  PassResult,
  RollResult,
  SimulationResult,
  TeamMember,
} from './types'

// Rutas relativas: el proxy de Vite (vite.config.ts) las reenvia a la API
// FastAPI en http://localhost:8000 durante el desarrollo.
const api = axios.create()

// Token JWT en memoria (variable de modulo, nunca localStorage/sessionStorage).
// AuthContext llama a setAuthToken() en login/register/logout; el interceptor
// lo adjunta a cada peticion saliente.
let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})

export async function register(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>('/auth/register', { email, password })
  return data.access_token
}

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password })
  return data.access_token
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me')
  return data
}

export async function startDraft(formation: FormationName): Promise<number> {
  const { data } = await api.post<{ draft_session_id: number }>('/game/draft/start', { formation })
  return data.draft_session_id
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
