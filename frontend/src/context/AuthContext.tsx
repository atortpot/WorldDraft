import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cookieLogin, cookieLogout, getMe, register as apiRegister } from '../api/client'

interface AuthUser {
  id: number
  email: string
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  // Al arrancar la app, la unica fuente de verdad sobre si hay sesion es la
  // cookie httpOnly: no hay nada persistido en el propio frontend que
  // consultar, asi que se pregunta al backend.
  useEffect(() => {
    getMe()
      .then((me) => {
        setUser({ id: me.id, email: me.email })
        setStatus('authenticated')
      })
      .catch(() => {
        setStatus('unauthenticated')
      })
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      login: async (email: string, password: string) => {
        const me = await cookieLogin(email, password)
        setUser({ id: me.id, email: me.email })
        setStatus('authenticated')
      },
      register: async (email: string, password: string) => {
        // /auth/register solo crea la cuenta (queda tambien disponible via
        // Bearer para Swagger); el login por cookie es lo que establece la
        // sesion persistida que usa el frontend.
        await apiRegister(email, password)
        const me = await cookieLogin(email, password)
        setUser({ id: me.id, email: me.email })
        setStatus('authenticated')
      },
      logout: async () => {
        await cookieLogout()
        setUser(null)
        setStatus('unauthenticated')
      },
    }),
    [status, user],
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
