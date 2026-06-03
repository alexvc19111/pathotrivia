import { useState, useEffect, useCallback, useMemo } from 'react'
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

// Normalizador helper para mitigar inconsistencias de la API
const normalizeQuestion = (q) => ({
  id: q.id,
  type: q.type,
  points: q.points ?? 0,
  timeLimit: q.time_limit_sec ?? q.timeLimitSec ?? 30,
  text: q.question_text ?? q.questionText ?? '',
})

export default function AdminDashboard() {
  const { authHeaders, clearToken, setSession } = useGame()
  const navigate = useNavigate()
  
  // Estados de Datos
  const [quizzes, setQuizzes] = useState([])
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  
  // Estados de UI/Flujo
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'addQuestion' | 'importPdf'
  const [editingQ, setEditingQ] = useState(null)
  const [showNewQuiz, setShowNewQuiz] = useState(false)
  const [startingSession, setStartingSession] = useState(false)

  // Handlers de carga de datos
  const fetchQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${APP_URL}/api/quizzes`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setQuizzes(data)
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
      const data = await res.json()
      setQuestions(data.map(normalizeQuestion))
    } catch {
      toast.error('Error al cargar preguntas')
    }
  }, [authHeaders])

  // Efectos reactivos colaterales
  useEffect(() => { 
    fetchQuizzes() 
  }, [fetchQuizzes])

  useEffect(() => { 
    if (activeQuiz?.id) {
      fetchQuestions(activeQuiz.id)
    } 
  }, [activeQuiz, fetchQuestions])

  // Mutaciones del estado / API
  async function handleCreateQuiz(title, description) {
    try {
      const res = await fetch(`${APP_URL}/api/quizzes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title, description })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success('Quiz creado ✓')
      setShowNewQuiz(false)
      
      // Mutación local optimista para evitar doble parpadeo antes del re-fetch
      setQuizzes(prev => [data, ...prev])
      setActiveQuiz(data)
      setView('editor')
    } catch (err) { 
      toast.error(err.message) 
    }
  }

  async function handleDeleteQuiz(id) {
    if (!confirm('¿Eliminar este quiz y todas sus preguntas?')) return
    try {
      const res = await fetch(`${APP_URL}/api/quizzes/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      
      toast.success('Quiz eliminado')
      if (activeQuiz?.id === id) { 
        setActiveQuiz(null)
        setView('list') 
      }
      setQuizzes(prev => prev.filter(q => q.id !== id))
    } catch (err) { 
      toast.error(err.message || 'Error al eliminar') 
    }
  }

  async function handleDeleteQuestion(qId) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      const res = await fetch(`${APP_URL}/api/questions/${qId}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      
      toast.success('Pregunta eliminada')
      setQuestions(prev => prev.filter(q => q.id !== qId))
    } catch (err) { 
      toast.error(err.message || 'Error al eliminar la pregunta') 
    }
  }

  async function handleOpenEditor(q) {
    try {
      const res = await fetch(`${APP_URL}/api/quizzes/${activeQuiz.id}/questions`, { headers: authHeaders() })
      if (res.ok) {
        const all = await res.json()
        const full = all.find(x => x.id === q.id) ?? q
        setEditingQ(normalizeQuestion(full))
      } else {
        setEditingQ(q)
      }
    } catch {
      setEditingQ(q)
    }
    setView('addQuestion')
  }

  async function handleStartSession() {
    if (!activeQuiz) return
    setStartingSession(true)
    try {
      const res = await fetch(`${APP_URL}/api/sessions`, {
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

  // Desvíos de render según la vista activa
  if (view === 'addQuestion') {
    return (
      <QuestionEditor 
        key={editingQ?.id ?? 'new'} 
        quizId={activeQuiz.id} 
        question={editingQ} 
        authHeaders={authHeaders} 
        onSaved={() => { fetchQuestions(activeQuiz.id); setView('editor'); setEditingQ(null) }} 
        onCancel={() => { setView('editor'); setEditingQ(null) }} 
      />
    )
  }

  if (view === 'importPdf') {
    return (
      <PDFImporter 
        quizId={activeQuiz.id} 
        authHeaders={authHeaders} 
        onDone={() => { fetchQuestions(activeQuiz.id); setView('editor') }} 
        onCancel={() => setView('editor')} 
      />
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      
      {/* Header Abstraído estructuralmente */}
      <header className="glass" style={styles.header}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'1.5rem' }}>⚡</span>
          <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.25rem' }}>Pathotrivia</span>
          <span style={{ color:'var(--text3)', fontSize:'0.85rem' }}>/ Admin</span>
        </div>
        <button className="btn-ghost" onClick={() => { clearToken(); navigate('/admin/login') }} style={{ fontSize:'0.85rem', padding:'0.5rem 1rem' }}>
          Cerrar sesión
        </button>
      </header>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        
        {/* Barra Lateral (Quizzes) */}
        <aside style={styles.sidebar}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1rem' }}>Mis Quizzes</h2>
            <button className="btn-primary" style={{ padding:'0.4rem 0.9rem', fontSize:'0.8rem', borderRadius:'8px' }} onClick={() => setShowNewQuiz(true)}>
              + Nuevo
            </button>
          </div>

          {showNewQuiz && (
            <NewQuizForm onCreate={handleCreateQuiz} onCancel={() => setShowNewQuiz(false)} />
          )}

          {loading && <p style={styles.centeredText}>Cargando...</p>}

          {quizzes.map((q, i) => (
            <QuizRow 
              key={q.id} 
              quiz={q} 
              index={i} 
              isActive={activeQuiz?.id === q.id} 
              onSelect={() => { setActiveQuiz(q); setView('editor') }} 
              onDelete={handleDeleteQuiz} 
            />
          ))}

          {quizzes.length === 0 && !loading && (
            <div style={styles.emptyContainer}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📭</div>
              <p>Sin quizzes todavía</p>
            </div>
          )}
        </aside>

        {/* Panel Principal */}
        <main style={{ flex:1, overflowY:'auto', padding:'2rem' }}>
          {!activeQuiz ? (
            <div style={styles.emptyMain}>
              <div className="animate-float" style={{ fontSize:'4rem', marginBottom:'1rem' }}>🎯</div>
              <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.5rem', color:'var(--text2)', marginBottom:'0.5rem' }}>Selecciona un quiz</h2>
              <p style={{ fontSize:'0.9rem' }}>Elige uno de la barra lateral o crea uno nuevo</p>
            </div>
          ) : (
            <div className="animate-fadeIn">
              <div style={styles.mainHeader}>
                <div>
                  <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.75rem', marginBottom:'0.25rem' }}>{activeQuiz.title}</h1>
                  {activeQuiz.description && <p style={{ color:'var(--text3)', fontSize:'0.9rem' }}>{activeQuiz.description}</p>}
                  <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginTop:'0.5rem' }}>
                    {questions.length} pregunta{questions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                  <button className="btn-ghost" onClick={() => setView('importPdf')} style={{ fontSize:'0.85rem' }}>📄 Importar PDF</button>
                  <button className="btn-ghost" onClick={() => { setEditingQ(null); setView('addQuestion') }} style={{ fontSize:'0.85rem' }}>+ Pregunta</button>
                  <button className="btn-primary" onClick={handleStartSession} disabled={startingSession || questions.length === 0} style={{ fontSize:'0.9rem' }}>
                    {startingSession ? 'Iniciando...' : '▶ Iniciar juego'}
                  </button>
                </div>
              </div>

              {questions.length === 0 && (
                <div style={styles.emptyQuestions}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🙈</div>
                  <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'1.1rem', color:'var(--text2)' }}>Sin preguntas aún</p>
                  <p style={{ fontSize:'0.9rem', marginTop:'0.25rem' }}>Agrega preguntas o importa desde PDF</p>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {questions.map((q, i) => (
                  <QuestionRow 
                    key={q.id} 
                    question={q} 
                    index={i} 
                    onEdit={handleOpenEditor} 
                    onDelete={handleDeleteQuestion} 
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/* --- SUBCOMPONENTES INTERNOS PARA LIMPIEZA DE CÓDIGO --- */

function NewQuizForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreate(title, desc)
  }

  return (
    <form onSubmit={handleSubmit} className="card animate-popIn" style={styles.newQuizForm}>
      <input className="input-field" placeholder="Título del quiz" value={title} onChange={e => setTitle(e.target.value)} required style={{ marginBottom:'0.5rem', fontSize:'0.9rem' }} />
      <input className="input-field" placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} style={{ marginBottom:'0.75rem', fontSize:'0.9rem' }} />
      <div style={{ display:'flex', gap:'0.5rem' }}>
        <button className="btn-primary" type="submit" style={{ flex:1, padding:'0.5rem', fontSize:'0.85rem' }}>Crear</button>
        <button className="btn-ghost" type="button" style={{ padding:'0.5rem 0.75rem', fontSize:'0.85rem' }} onClick={onCancel}>✕</button>
      </div>
    </form>
  )
}

function QuizRow({ quiz, index, isActive, onSelect, onDelete }) {
  return (
    <div 
      className="animate-slideIn" 
      onClick={onSelect}
      style={{
        ...styles.quizRow,
        animationDelay: `${index * 0.05}s`,
        background: isActive ? 'rgba(124,58,237,0.15)' : 'var(--surface)',
        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <p style={styles.quizRowTitle}>{quiz.title}</p>
        <p style={{ color:'var(--text3)', fontSize:'0.78rem', marginTop:'0.15rem' }}>{quiz.question_count ?? 0} preguntas</p>
      </div>
      <button 
        onClick={e => { e.stopPropagation(); onDelete(quiz.id) }} 
        style={styles.deleteIconBtn}
      >🗑</button>
    </div>
  )
}

function QuestionRow({ question, index, onEdit, onDelete }) {
  const typeInfo = useMemo(() => QUESTION_TYPES.find(t => t.id === question.type) || { icon: '❓', label: 'Desconocido' }, [question.type])

  return (
    <div className="animate-slideIn" style={{ ...styles.questionRow, animationDelay: `${index * 0.04}s` }}>
      <div style={styles.questionIconBadge}>{typeInfo.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.2rem' }}>
          <span style={{ fontSize:'0.75rem', color:'var(--text3)', fontWeight:500 }}>#{index + 1}</span>
          <span style={{ fontSize:'0.72rem', background:'var(--bg3)', color:'var(--text2)', padding:'0.1rem 0.5rem', borderRadius:'20px' }}>{typeInfo.label}</span>
          <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>{question.timeLimit}s · {question.points}pts</span>
        </div>
        <p style={styles.questionTextTruncate}>{question.text}</p>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', flexShrink:0 }}>
        <button onClick={() => onEdit(question)} style={styles.actionBtnEdit}>✏️ Editar</button>
        <button onClick={() => onDelete(question.id)} style={styles.actionBtnDelete}>🗑</button>
      </div>
    </div>
  )
}

/* --- OBJETO DE ESTILOS CENTRALIZADOS (Clean code alternativo a CSS Modules) --- */
const styles = {
  header: { padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none' },
  sidebar: { width:'320px', borderRight:'1px solid var(--border)', background:'var(--bg2)', overflowY:'auto', padding:'1.5rem 1rem' },
  centeredText: { color:'var(--text3)', textAlign:'center', padding:'2rem 0', fontSize:'0.9rem' },
  emptyContainer: { textAlign:'center', color:'var(--text3)', padding:'3rem 1rem', fontSize:'0.9rem' },
  emptyMain: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text3)', textAlign:'center' },
  mainHeader: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' },
  emptyQuestions: { textAlign:'center', padding:'4rem', color:'var(--text3)' },
  newQuizForm: { marginBottom:'1rem', padding:'1rem', background:'var(--surface2)' },
  quizRow: { padding:'0.875rem 1rem', borderRadius:'12px', marginBottom:'0.5rem', cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'space-between' },
  quizRowTitle: { fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  deleteIconBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'0.25rem', fontSize:'0.85rem' },
  questionRow: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'14px', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem' },
  questionIconBadge: { width:'36px', height:'36px', borderRadius:'10px', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 },
  questionTextTruncate: { color:'var(--text)', fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  actionBtnEdit: { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'0.4rem 0.75rem', cursor:'pointer', color:'var(--text2)', fontSize:'0.8rem' },
  actionBtnDelete: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'0.4rem 0.75rem', cursor:'pointer', color:'var(--red)', fontSize:'0.8rem' }
}
