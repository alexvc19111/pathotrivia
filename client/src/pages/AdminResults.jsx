import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext.jsx'
import toast from 'react-hot-toast'

export default function AdminResults() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const { authHeaders } = useGame()
  const [results, setResults]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/sessions/${sessionId}/results`, { headers: authHeaders() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResults(data)
      } catch (err) {
        toast.error('Error cargando resultados')
        navigate('/admin')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sessionId]) // eslint-disable-line

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="animate-spin" style={{ width:'48px', height:'48px', border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%' }} />
    </div>
  )

  const { session, players, questions } = results ?? {}

  const sortedPlayers = [...(players ?? [])].sort((a, b) => {
    const scoreB = b.finalScore ?? b.final_score ?? 0
    const scoreA = a.finalScore ?? a.final_score ?? 0
    return scoreB - scoreA
  })

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <header className="glass" style={{ padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => navigate('/admin')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:'1.1rem', padding:'0.25rem' }}>←</button>
          <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.1rem' }}>Resultados</span>
          <span style={{ color:'var(--text3)', fontSize:'0.85rem' }}>/ {session?.quizTitle ?? session?.quiz_title}</span>
        </div>
        <span style={{ color:'var(--text3)', fontSize:'0.85rem' }}>
          {new Date(session?.finishedAt || session?.finished_at || session?.createdAt || session?.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
        </span>
      </header>

      <div style={{ padding:'1.5rem 2rem', borderBottom:'1px solid var(--border)', display:'flex', gap:'0.5rem' }}>
        {['overview','players','questions'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding:'0.5rem 1.25rem', borderRadius:'20px', border:'none', cursor:'pointer', fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'0.85rem', background:activeTab===tab?'var(--accent)':'var(--surface)', color:activeTab===tab?'white':'var(--text2)', transition:'all 0.2s' }}>
            {tab==='overview' ? 'Resumen' : tab==='players' ? 'Jugadores' : 'Preguntas'}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'2rem' }}>

        {/* OVERVIEW */}
        {activeTab==='overview' && (
          <div className="animate-fadeIn" style={{ maxWidth:'900px', margin:'0 auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
              {[
                { label:'Jugadores',        value: players?.length ?? 0,                                                                                         icon:'👥' },
                { label:'Preguntas',         value: questions?.length ?? 0,                                                                                       icon:'❓' },
                { label:'Respuestas totales', value: players?.reduce((acc,p) => acc+(p.answersCount ?? p.answers_count ?? 0), 0) ?? 0,                            icon:'✍️' },
                { label:'Precisión media',   value: players?.length ? Math.round(players.reduce((acc,p) => acc+(p.accuracy??0),0)/players.length)+'%' : '—',     icon:'🎯' },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{stat.icon}</div>
                  <p style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2rem', color:'var(--text)' }}>{stat.value}</p>
                  <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginTop:'0.25rem' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.1rem', marginBottom:'1rem' }}>Podio</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {sortedPlayers.slice(0,10).map((p,i) => {
                const finalScore = p.finalScore ?? p.final_score ?? 0
                return (
                  <div key={p.id} className="animate-slideIn" style={{ animationDelay:`${i*0.04}s`, display:'flex', alignItems:'center', gap:'1rem', padding:'0.875rem 1.25rem', background:'var(--surface)', border:`1px solid ${i<3?['rgba(251,191,36,0.3)','rgba(209,213,219,0.2)','rgba(205,124,47,0.2)'][i]:'var(--border)'}`, borderRadius:'12px' }}>
                    <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.1rem', width:'32px', textAlign:'center', color:['#fbbf24','#d1d5db','#cd7c2f'][i]??'var(--text3)' }}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}
                    </span>
                    <span style={{ fontSize:'1.25rem' }}>{p.avatar??'🎮'}</span>
                    <span style={{ flex:1, fontWeight:500, color:'var(--text)' }}>{p.nickname}</span>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontFamily:'Syne, sans-serif', fontWeight:800, color:'var(--accent2)', fontSize:'1.1rem' }}>{finalScore?.toLocaleString()??0}</p>
                      <p style={{ color:'var(--text3)', fontSize:'0.78rem' }}>{p.accuracy??0}% correctas</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PLAYERS */}
        {activeTab==='players' && (
          <div className="animate-fadeIn" style={{ maxWidth:'1000px', margin:'0 auto' }}>
            <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.1rem', marginBottom:'1.5rem' }}>Respuestas por jugador</h3>
            {sortedPlayers.map((player, pi) => {
              const finalScore = player.finalScore ?? player.final_score ?? 0
              const answers    = player.answers ?? player.player_answers ?? []
              return (
                <div key={player.id} className="animate-slideIn card" style={{ animationDelay:`${pi*0.04}s`, marginBottom:'1rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom: answers.length ? '1rem' : 0 }}>
                    <span style={{ fontSize:'1.5rem' }}>{player.avatar??'🎮'}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1rem' }}>{player.nickname}</p>
                      <p style={{ color:'var(--text3)', fontSize:'0.8rem' }}>Puesto #{pi+1} · {finalScore?.toLocaleString()??0} pts · {player.accuracy??0}% correctas</p>
                    </div>
                  </div>

                  {answers.length === 0 && (
                    <p style={{ color:'var(--text3)', fontSize:'0.85rem', textAlign:'center', padding:'0.5rem' }}>Sin respuestas registradas</p>
                  )}

                  <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                    {answers.map((ans, ai) => {
                      const isCorrect      = ans.isCorrect     ?? ans.is_correct
                      const pointsEarned   = ans.pointsEarned  ?? ans.points_earned  ?? 0
                      const responseTimeMs = ans.responseTimeMs ?? ans.response_time_ms
                      const questionText   = ans.questionText  ?? ans.question_text

                      let displayAnswer = ans.answerDisplay ?? ans.answer_display
                      if (!displayAnswer && ans.answer_text) {
                        if (ans.answer_text === 'true')  displayAnswer = 'Verdadero'
                        else if (ans.answer_text === 'false') displayAnswer = 'Falso'
                        else displayAnswer = ans.answer_text
                      }
                      if (!displayAnswer && ans.answer_numeric != null) displayAnswer = String(ans.answer_numeric)

                      // Para tipos sin correcto (brainstorm, word_cloud, poll)
                      const showCorrectness = isCorrect !== null && isCorrect !== undefined

                      return (
                        <div key={ai} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem', background:'var(--surface2)', borderRadius:'10px', border:`1px solid ${isCorrect===true?'rgba(16,185,129,0.2)':isCorrect===false?'rgba(239,68,68,0.15)':'var(--border)'}` }}>
                          <span style={{ fontSize:'1rem' }}>
                            {isCorrect===true ? '✅' : isCorrect===false ? '❌' : '💬'}
                          </span>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'0.85rem', color:'var(--text2)' }}>P{ai+1}: {questionText}</p>
                            <p style={{ fontSize:'0.8rem', color:'var(--text3)', marginTop:'0.15rem' }}>
                              {displayAnswer ?? '—'}
                              {responseTimeMs ? <span style={{ marginLeft:'0.5rem' }}>· {(responseTimeMs/1000).toFixed(1)}s</span> : null}
                            </p>
                          </div>
                          <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, color:'var(--accent2)', fontSize:'0.9rem' }}>
                            {pointsEarned > 0 ? `+${pointsEarned}` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* QUESTIONS */}
        {activeTab==='questions' && (
          <div className="animate-fadeIn" style={{ maxWidth:'900px', margin:'0 auto' }}>
            <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.1rem', marginBottom:'1.5rem' }}>Estadísticas por pregunta</h3>
            {(questions??[]).map((q,qi) => {
              const totalAnswers   = q.totalAnswers   ?? q.total_answers   ?? 0
              const correctAnswers = q.correctAnswers ?? q.correct_answers ?? 0
              const avgTimeMs      = q.avgTimeMs      ?? q.avg_time_ms
              const questionText   = q.questionText   ?? q.question_text

              return (
                <div key={q.id} className="animate-slideIn card" style={{ animationDelay:`${qi*0.04}s`, marginBottom:'1rem' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', marginBottom:'1rem' }}>
                    <span style={{ background:'var(--surface2)', color:'var(--text3)', padding:'0.2rem 0.6rem', borderRadius:'6px', fontSize:'0.8rem', fontWeight:600, flexShrink:0 }}>#{qi+1}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ color:'var(--text)', fontWeight:500, lineHeight:1.4, marginBottom:'0.25rem' }}>{questionText}</p>
                      <span style={{ fontSize:'0.72rem', background:'var(--bg3)', color:'var(--text2)', padding:'0.1rem 0.5rem', borderRadius:'20px', textTransform:'capitalize' }}>
                        {q.type?.replace(/_/g,' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'1.5rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.85rem', color:'var(--text3)' }}>✍️ {totalAnswers} respuestas</span>
                    {correctAnswers > 0 && (
                      <span style={{ fontSize:'0.85rem', color:'var(--green)' }}>✅ {correctAnswers} correctas ({totalAnswers?Math.round(correctAnswers/totalAnswers*100):0}%)</span>
                    )}
                    <span style={{ fontSize:'0.85rem', color:'var(--text3)' }}>⏱ {avgTimeMs?(avgTimeMs/1000).toFixed(1)+'s':'-'} promedio</span>
                  </div>
                  {q.distribution?.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                      {q.distribution.map((d,di) => {
                        const isCorrectOpt = d.isCorrect ?? d.is_correct
                        return (
                          <div key={di}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
                              <span style={{ fontSize:'0.82rem', color:'var(--text2)' }}>{d.label}</span>
                              <span style={{ fontSize:'0.8rem', color:'var(--text3)' }}>{d.count} ({d.pct}%)</span>
                            </div>
                            <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                              <div style={{ width:`${d.pct}%`, height:'100%', background:isCorrectOpt?'var(--green)':'var(--accent)', borderRadius:'3px', transition:'width 1s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}