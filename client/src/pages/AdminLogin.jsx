import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'
import { API_URL } from '../config'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const { saveToken } = useGame()
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas')
      saveToken(data.token)
      navigate('/admin')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', width:'600px', height:'600px', background:'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', top:'-200px', left:'-200px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'400px', height:'400px', background:'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', bottom:'-100px', right:'-100px', pointerEvents:'none' }} />

      <div className="animate-fadeInUp" style={{ width:'100%', maxWidth:'420px', padding:'0 1.5rem' }}>
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'72px', height:'72px', borderRadius:'20px', background:'linear-gradient(135deg, var(--accent), var(--accent2))', fontSize:'2rem', marginBottom:'1rem', boxShadow:'0 8px 32px var(--accent-glow)' }}>⚡</div>
          <h1 style={{ fontSize:'2rem', fontFamily:'Syne, sans-serif', fontWeight:800, color:'var(--text)' }}>Pathotrivia</h1>
          <p style={{ color:'var(--text3)', marginTop:'0.25rem', fontSize:'0.9rem' }}>Panel de administración</p>
        </div>

        <div className="glass" style={{ borderRadius:'20px', padding:'2rem' }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.25rem', marginBottom:'1.5rem' }}>Iniciar sesión</h2>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'0.85rem', fontWeight:500, marginBottom:'0.5rem' }}>Usuario</label>
              <input className="input-field" type="text" placeholder="Admin" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'0.85rem', fontWeight:500, marginBottom:'0.5rem' }}>Contraseña</label>
              <input className="input-field" type="password" placeholder="••••••" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop:'0.5rem', width:'100%', padding:'0.875rem' }}>
              {loading ? 'Verificando...' : 'Entrar al panel →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', color:'var(--text3)', fontSize:'0.8rem', marginTop:'1.5rem' }}>
          ¿Eres jugador?{' '}<a href="/" style={{ color:'var(--accent2)', textDecoration:'none', fontWeight:500 }}>Únete a una partida</a>
        </p>
      </div>
    </div>
  )
}
