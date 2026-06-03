import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'
import { APP_URL } from '../config'
import toast from 'react-hot-toast'
import QuestionEditor from '../components/QuestionEditor.jsx'
import PDFImporter from '../components/PDFImporter.jsx'

const QUESTION_TYPES = [
  { id: 'multiple_choice', icon: '🔵', label: 'Opción múltiple' },
  { id: 'true_false',      icon: '✅', label: 'Verdadero / Falso' },
  { id: 'type_answer',     icon: '⌨️',  label: 'Escribir respuesta' },
  { id: 'puzzle',          icon: '🧩', label: 'Puzzle (ordenar)' },
  { id: 'poll',            icon: '📊', label: 'Encuesta' },
  { id: 'word_cloud',      icon: '☁️',  label: 'Nube de palabras' },
  { id: 'slider',          icon: '🎚️', label: 'Deslizador numérico' },
  { id: 'brainstorm',      icon: '💡', label: 'Brainstorm' },
  { id: 'drop_pin',        icon: '📍', label: 'Señalar en imagen' },
  { id: 'matching',        icon: '🔗', label: 'Emparejar' },
]

export default function AdminDashboard() {
  const { authHeaders, clearToken, setSession } = useGame()
  const navigate = useNavigate()
  const [quizzes, setQuizzes]           = useState([])
  const [activeQuiz, setActiveQuiz]     = useState(null)
  const [questions, setQuestions]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [view, setView]                 = useState('list')
  const [editingQ, setEditingQ]         = useState(null)
  const [showNewQuiz, setShowNewQuiz]   = useState(false)
  const [newQuizTitle, setNewQuizTitle] = useState('')
  const [newQuizDesc, setNewQuizDesc]   = useState('')
  const [startingSession, setStartingSession] = useState(false)

  const fetchQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${APP_URL}/api/quizzes`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      setQuizzes(await res.json())
    } catch {
      toast.error('Error al cargar quizzes')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchQuestions = useCallback(async (quizId) => {
    try {
      const res = await fetch(`${APP_URL}/api/quizzes/${quizId}/questions`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      setQuestions(await res.json())
    } catch {
      toast.error('Error al cargar preguntas')
    }
  }, [authHeaders])

  useEffect(() => { fetchQuizzes() }, [fetchQuizzes])
  useEffect(() => { if (activeQuiz) fetchQuestions(activeQuiz.id) }, [activeQuiz, fetchQuestions])

  async function createQuiz(e) {
    e.preventDefault()
    try {
      const res = await fetch(`${APP_URL}/api/quizzes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: newQuizTitle, description: newQuizDesc })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Quiz creado ✓')
      setShowNewQuiz(false); setNewQuizTitle(''); setNewQuizDesc('')
      fetchQuizzes(); setActiveQuiz(data); setView('editor')
    } catch (err) { toast.error(err.message) }
  }

  async function deleteQuiz(id) {
    if (!confirm('¿Eliminar este quiz y todas sus preguntas?')) return
    try {
      const res  = await fetch(`${APP_URL}/api/quizzes/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      toast.success('Quiz eliminado')
      if (activeQuiz?.id === id) { setActiveQuiz(null); setView('list') }
      fetchQuizzes()
    } catch (err) { toast.error(err.message || 'Error al eliminar') }
  }

  async function deleteQuestion(qId) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      const res  = await fetch(`${APP_URL}/api/questions/${qId}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      toast.success('Pregunta eliminada')
      fetchQuestions(activeQuiz.id)
    } catch (err) { toast.error(err.message || 'Error al eliminar la pregunta') }
  }

  // Abre el editor con la pregunta completa (incluyendo sus opciones)
  async function openEditor(q) {
    try {
      const res = await fetch(`${APP_URL}/api/quizzes/${activeQuiz.id}/questions`, { headers: authHeaders() })
      if (res.ok) {
        const all  = await res.json()
        const full = all.find(x => x.id === q.id) ?? q
        setEditingQ(full)
      } else {
        setEditingQ(q)
      }
    } catch {
      setEditingQ(q)
    }
    setView('addQuestion')
  }

  async function startSession() {
    if (!activeQuiz) return
    setStartingSession(true)
    try {
      const res  = await fetch(`${APP_URL}/api/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ quizId: activeQuiz.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession(data)
      navigate(`/admin/game/${data.id}`)
    } catch (err) {
      toast.error(err.message || 'No se pudo iniciar la sesión')
    } finally {
      setStartingSession(false)
    }
  }

  if (view === 'addQuestion') {
    return <QuestionEditor key={editingQ?.id ?? 'new'} quizId={activeQuiz.id} question={editingQ} authHeaders={authHeaders} onSaved={() => { fetchQuestions(activeQuiz.id); setView('editor'); setEditingQ(null) }} onCancel={() => { setView('editor'); setEditingQ(null) }} />
  }
  if (view === 'importPdf') {
    return <PDFImporter quizId={activeQuiz.id} authHeaders={authHeaders} onDone={() => { fetchQuestions(activeQuiz.id); setView('editor') }} onCancel={() => setView('editor')} />
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <header className="glass" style={{ padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'1.5rem' }}>⚡</span>
          <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.25rem' }}>Pathotrivia</span>
          <span style={{ color:'var(--text3)', fontSize:'0.85rem' }}>/ Admin</span>
        </div>
        <button className="btn-ghost" onClick={() => { clearToken(); navigate('/admin/login') }} style={{ fontSize:'0.85rem', padding:'0.5rem 1rem' }}>Cerrar sesión</button>
      </header>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <aside style={{ width:'320px', borderRight:'1px solid var(--border)', background:'var(--bg2)', overflowY:'auto', padding:'1.5rem 1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1rem' }}>Mis Quizzes</h2>
            <button className="btn-primary" style={{ padding:'0.4rem 0.9rem', fontSize:'0.8rem', borderRadius:'8px' }} onClick={() => setShowNewQuiz(true)}>+ Nuevo</button>
          </div>

          {showNewQuiz && (
            <form onSubmit={createQuiz} className="card animate-popIn" style={{ marginBottom:'1rem', padding:'1rem', background:'var(--surface2)' }}>
              <input className="input-field" placeholder="Título del quiz" value={newQuizTitle} onChange={e=>setNewQuizTitle(e.target.value)} required style={{ marginBottom:'0.5rem', fontSize:'0.9rem' }} />
              <input className="input-field" placeholder="Descripción (opcional)" value={newQuizDesc} onChange={e=>setNewQuizDesc(e.target.value)} style={{ marginBottom:'0.75rem', fontSize:'0.9rem' }} />
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="btn-primary" type="submit" style={{ flex:1, padding:'0.5rem', fontSize:'0.85rem' }}>Crear</button>
                <button className="btn-ghost" type="button" style={{ padding:'0.5rem 0.75rem', fontSize:'0.85rem' }} onClick={() => setShowNewQuiz(false)}>✕</button>
              </div>
            </form>
          )}

          {loading && <p style={{ color:'var(--text3)', textAlign:'center', padding:'2rem 0', fontSize:'0.9rem' }}>Cargando...</p>}

          {quizzes.map((q, i) => (
            <div key={q.id} className="animate-slideIn" style={{ animationDelay:`${i*0.05}s`, padding:'0.875rem 1rem', borderRadius:'12px', marginBottom:'0.5rem', cursor:'pointer', background: activeQuiz?.id===q.id ? 'rgba(124,58,237,0.15)' : 'var(--surface)', border:`1px solid ${activeQuiz?.id===q.id ? 'var(--accent)' : 'var(--border)'}`, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'space-between' }} onClick={() => { setActiveQuiz(q); setView('editor') }}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.title}</p>
                <p style={{ color:'var(--text3)', fontSize:'0.78rem', marginTop:'0.15rem' }}>{q.question_count ?? 0} preguntas</p>
              </div>
              <button onClick={e=>{ e.stopPropagation(); deleteQuiz(q.id) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'0.25rem', fontSize:'0.85rem' }}>🗑</button>
            </div>
          ))}

          {quizzes.length===0 && !loading && (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:'3rem 1rem', fontSize:'0.9rem' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📭</div>
              <p>Sin quizzes todavía</p>
            </div>
          )}
        </aside>

        <main style={{ flex:1, overflowY:'auto', padding:'2rem' }}>
          {!activeQuiz && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text3)', textAlign:'center' }}>
              <div className="animate-float" style={{ fontSize:'4rem', marginBottom:'1rem' }}>🎯</div>
              <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.5rem', color:'var(--text2)', marginBottom:'0.5rem' }}>Selecciona un quiz</h2>
              <p style={{ fontSize:'0.9rem' }}>Elige uno de la barra lateral o crea uno nuevo</p>
            </div>
          )}

          {activeQuiz && (
            <div className="animate-fadeIn">
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
                <div>
                  <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.75rem', marginBottom:'0.25rem' }}>{activeQuiz.title}</h1>
                  {activeQuiz.description && <p style={{ color:'var(--text3)', fontSize:'0.9rem' }}>{activeQuiz.description}</p>}
                  <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginTop:'0.5rem' }}>{questions.length} pregunta{questions.length!==1?'s':''}</p>
                </div>
                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                  <button className="btn-ghost" onClick={() => setView('importPdf')} style={{ fontSize:'0.85rem' }}>📄 Importar PDF</button>
                  <button className="btn-ghost" onClick={() => { setEditingQ(null); setView('addQuestion') }} style={{ fontSize:'0.85rem' }}>+ Pregunta</button>
                  <button className="btn-primary" onClick={startSession} disabled={startingSession || questions.length===0} style={{ fontSize:'0.9rem' }}>
                    {startingSession ? 'Iniciando...' : '▶ Iniciar juego'}
                  </button>
                </div>
              </div>

              {questions.length===0 && (
                <div style={{ textAlign:'center', padding:'4rem', color:'var(--text3)' }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🙈</div>
                  <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'1.1rem', color:'var(--text2)' }}>Sin preguntas aún</p>
                  <p style={{ fontSize:'0.9rem', marginTop:'0.25rem' }}>Agrega preguntas o importa desde PDF</p>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {questions.map((q, i) => {
                  const typeInfo = QUESTION_TYPES.find(t => t.id === q.type)
                  return (
                    <div key={q.id} className="animate-slideIn" style={{ animationDelay:`${i*0.04}s`, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'14px', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>{typeInfo?.icon ?? '❓'}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.2rem' }}>
                          <span style={{ fontSize:'0.75rem', color:'var(--text3)', fontWeight:500 }}>#{i+1}</span>
                          <span style={{ fontSize:'0.72rem', background:'var(--bg3)', color:'var(--text2)', padding:'0.1rem 0.5rem', borderRadius:'20px' }}>{typeInfo?.label}</span>
                          <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>{q.time_limit_sec ?? q.timeLimitSec}s · {q.points}pts</span>
                        </div>
                        <p style={{ color:'var(--text)', fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.question_text ?? q.questionText}</p>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', flexShrink:0 }}>
                        <button
                          onClick={() => openEditor(q)}
                          style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'0.4rem 0.75rem', cursor:'pointer', color:'var(--text2)', fontSize:'0.8rem' }}
                        >✏️ Editar</button>
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'0.4rem 0.75rem', cursor:'pointer', color:'var(--red)', fontSize:'0.8rem' }}
                        >🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
