import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DraftRoundCode, FormationName, SimulationResult } from '../api/types'

interface DraftContextValue {
  sessionId: number | null
  formation: FormationName | null
  startSession: (sessionId: number, formation: FormationName) => void
  currentRound: DraftRoundCode
  lastResult: SimulationResult | null
  matchHistory: SimulationResult[]
  recordMatchResult: (result: SimulationResult) => void
  reset: () => void
}

const DraftContext = createContext<DraftContextValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [formation, setFormation] = useState<FormationName | null>(null)
  const [currentRound, setCurrentRound] = useState<DraftRoundCode>('group_1')
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<SimulationResult[]>([])

  const value = useMemo(
    () => ({
      sessionId,
      formation,
      startSession: (newSessionId: number, newFormation: FormationName) => {
        setSessionId(newSessionId)
        setFormation(newFormation)
      },
      currentRound,
      lastResult,
      matchHistory,
      recordMatchResult: (result: SimulationResult) => {
        setLastResult(result)
        setCurrentRound(result.next_round)
        setMatchHistory((prev) => [...prev, result])
      },
      reset: () => {
        setSessionId(null)
        setFormation(null)
        setCurrentRound('group_1')
        setLastResult(null)
        setMatchHistory([])
      },
    }),
    [sessionId, formation, currentRound, lastResult, matchHistory],
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
