import { useCallback } from 'react'
import { useGame } from '../context/GameContext.jsx'

export function useGameState() {
  const { setSession, setPlayers, setCurrentQ, setQStats, setPhase, setAnswerCount, setExplanation } = useGame()

  const handleWsMessage = useCallback((msg) => {
    if (!msg?.type) return

    switch (msg.type) {

      // El gameHandler ahora manda { session: {...} } sin wrapper "data"
      case 'SESSION_UPDATE':
        setSession(msg.session ?? msg.data)
        break

      // Antes: { data: [...] }  →  Ahora: { players: [...] }
      case 'PLAYERS_UPDATE':
        setPlayers(msg.players ?? msg.data ?? [])
        break

      // Antes: { data: { index, question... } }  →  Ahora: plano { index, question... }
      case 'QUESTION':
        setExplanation(null)
        setCurrentQ({
          index:          msg.index          ?? msg.data?.index,
          totalQuestions: msg.totalQuestions  ?? msg.data?.totalQuestions,
          timeLimit:      msg.timeLimit       ?? msg.data?.timeLimit ?? msg.data?.question?.timeLimitSec,
          question:       msg.question        ?? msg.data?.question ?? msg.data
        })
        setPhase('question')
        break

      // Antes: mensaje separado QUESTION_STATS + QUESTION_RESULTS
      // Ahora: un solo mensaje QUESTION_RESULTS con { stats, players }
      case 'QUESTION_RESULTS':
        setQStats(msg.stats    ?? msg.data)
        setPlayers(msg.players  ?? [])
        setExplanation(msg.explanation || null)
        setPhase('results')
        break

      // Compatibilidad con el mensaje separado que antes se mandaba
      case 'QUESTION_STATS':
        setQStats(msg.stats ?? msg.data)
        break

      // Podio final con jugadores rankeados
      case 'PODIUM':
        setPlayers(msg.players ?? msg.data ?? [])
        setPhase('podium')
        break

      case 'GAME_FINISHED':
        setPhase('finished')
        break

      // PHASE_CHANGE como fallback por si el servidor lo sigue mandando
      case 'ANSWER_COUNT':
        setAnswerCount({ answered: msg.answered, total: msg.total })
        break

      case 'PHASE_CHANGE':
        setPhase(msg.phase)
        break

      default:
        break
    }
  }, [setSession, setPlayers, setCurrentQ, setQStats, setPhase])

  return { handleWsMessage }
}