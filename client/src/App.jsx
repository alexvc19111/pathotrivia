import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { GameProvider } from './context/GameContext.jsx'
import AdminLogin     from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminGame      from './pages/AdminGame.jsx'
import AdminResults   from './pages/AdminResults.jsx'
import PlayerLobby    from './pages/PlayerLobby.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                          element={<PlayerLobby />} />
          <Route path="/admin/login"               element={<AdminLogin />} />
          <Route path="/admin"                     element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/game/:sessionId"     element={<ProtectedRoute><AdminGame /></ProtectedRoute>} />
          <Route path="/admin/results/:sessionId"  element={<ProtectedRoute><AdminResults /></ProtectedRoute>} />
          <Route path="*"                          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e1e2e', color: '#f0f0ff', border: '1px solid #2e2e45', fontFamily: 'DM Sans, sans-serif' } }} />
    </GameProvider>
  )
}