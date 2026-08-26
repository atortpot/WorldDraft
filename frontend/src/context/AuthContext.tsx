import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { getMe, login as apiLogin, register as apiRegister, setAuthToken } from '../api/client'

interface AuthUser {
  id: number
  email: string
}

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // El token solo vive en memoria (estado de React): nunca se persiste en
  // localStorage/sessionStorage, asi que se pierde al recargar la pagina.
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  async function applyToken(accessToken: string) {
    setAuthToken(accessToken)
    setToken(accessToken)
    const me = await getMe()
    setUser({ id: me.id, email: me.email })
  }

  const value = useMemo(
    () => ({
      token,
      user,
      login: async (email: string, password: string) => {
        await applyToken(await apiLogin(email, password))
      },
      register: async (email: string, password: string) => {
        await applyToken(await apiRegister(email, password))
      },
      logout: () => {
        setAuthToken(null)
        setToken(null)
        setUser(null)
      },
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
