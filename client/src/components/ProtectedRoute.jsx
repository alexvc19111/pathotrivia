import { Navigate } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'

export default function ProtectedRoute({ children }) {
  const { adminToken } = useGame()
  if (!adminToken) return <Navigate to="/admin/login" replace />
  return children
}