import { createContext, useContext, useState, useCallback } from 'react'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [session, setSession]           = useState(null)
  const [players, setPlayers]           = useState([])
  const [currentQ, setCurrentQ]         = useState(null)
  const [qStats, setQStats]             = useState(null)
  const [phase, setPhase]               = useState('idle')
  const [answerCount, setAnswerCount]   = useState({ answered: 0, total: 0 })
  const [explanation, setExplanation]   = useState(null)
  const [adminToken, setAdminToken]     = useState(() => localStorage.getItem('admin_token'))

  const saveToken = useCallback((token) => {
    setAdminToken(token)
    localStorage.setItem('admin_token', token)
  }, [])

  const clearToken = useCallback(() => {
    setAdminToken(null)
    localStorage.removeItem('admin_token')
  }, [])

  const authHeaders = useCallback(() => {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`
  }

  return headers
}, [adminToken])

  return (
    <GameContext.Provider value={{
      session, setSession,
      players, setPlayers,
      currentQ, setCurrentQ,
      qStats, setQStats,
      phase, setPhase,
      answerCount, setAnswerCount,
      explanation, setExplanation,
      adminToken, saveToken, clearToken, authHeaders
    }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be inside GameProvider')
  return ctx
}
