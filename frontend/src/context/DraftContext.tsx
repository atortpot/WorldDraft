import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SimulationResult } from '../api/types'

interface DraftContextValue {
  sessionId: number | null
  setSessionId: (id: number | null) => void
  result: SimulationResult | null
  setResult: (result: SimulationResult | null) => void
  reset: () => void
}

const DraftContext = createContext<DraftContextValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)

  const value = useMemo(
    () => ({
      sessionId,
      setSessionId,
      result,
      setResult,
      reset: () => {
        setSessionId(null)
        setResult(null)
      },
    }),
    [sessionId, result],
  )

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext)
  if (!ctx) {
    throw new Error('useDraft debe usarse dentro de <DraftProvider>')
  }
  return ctx
}
