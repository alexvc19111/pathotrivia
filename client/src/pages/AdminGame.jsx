import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useGame } from '../context/GameContext.jsx'
import { useWebSocket, buildWsUrl } from '../hooks/useWebSocket.js'
import { useGameState } from '../hooks/useGameState.js'
import { API_URL } from '../config'
import toast from 'react-hot-toast'

const ANSWER_COLORS = ['#e53e3e','#3182ce','#38a169','#d69e2e']
const ANSWER_ICONS  = ['▲','◆','●','★']

export default function AdminGame() {
  const { sessionId }    = useParams()
  const navigate         = useNavigate()
  const { authHeaders, phase, setPhase, players, currentQ, qStats, session, setSession, answerCount, setAnswerCount, explanation } = useGame()
  const { handleWsMessage } = useGameState()
  const [sessionPin, setSessionPin]   = useState(null)
  const [timeLeft, setTimeLeft]       = useState(0)
  const timerRef = useRef(null)
  const playerUrl = sessionPin ? `${window.location.origin}/?pin=${sessionPin}` : ''

  const wsUrl = sessionId
  ? buildWsUrl({
      role: 'admin',
      sessionId
    })
  : null

  const { send } = useWebSocket({ url: wsUrl, onMessage: handleWsMessage, enabled: !!sessionId })

  useEffect(() => {
    async function loadSession() {
      try {
        const res  = await fetch(`${API_URL}/api/sessions/${sessionId}`, { headers: authHeaders() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSession(data)
        setSessionPin(data.pin)
        setPhase(data.status==='waiting'?'lobby':data.status==='in_progress'?'question':'finished')
      } catch { toast.error('Error cargando sesión'); navigate('/admin') }
    }
    loadSession()
  }, [sessionId]) // eslint-disable-line

  useEffect(() => {
    if (phase==='question' && currentQ) {
      setTimeLeft(currentQ.timeLimit ?? 20)
      setAnswerCount({ answered: 0, total: players.length })
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => { if(t<=1){ clearInterval(timerRef.current); return 0 } return t-1 })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [phase, currentQ])

  const sendNextQuestion = () => send({ type: 'NEXT_QUESTION' })
  const sendShowResults  = () => send({ type: 'SHOW_RESULTS' })
  const sendEndGame      = () => send({ type: 'END_GAME' })

  if (phase==='lobby' || phase==='idle') {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 30% 30%, rgba(124,58,237,0.15) 0%, transparent 60%)', pointerEvents:'none' }} />
        <div className="animate-popIn" style={{ textAlign:'center', marginBottom:'2rem' }}>
          <p style={{ color:'var(--text3)', fontSize:'0.9rem', marginBottom:'0.5rem', fontFamily:'Syne, sans-serif' }}>PIN DE LA PARTIDA</p>
          <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'5rem', letterSpacing:'0.1em', background:'linear-gradient(135deg, var(--accent2), var(--text))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>
            {sessionPin ?? '------'}
          </h1>
          <p style={{ color:'var(--text2)', marginTop:'0.5rem', fontSize:'0.95rem' }}>{session?.quizTitle ?? 'Cargando...'}</p>
        </div>
        <div style={{ display:'flex', gap:'3rem', alignItems:'center', flexWrap:'wrap', justifyContent:'center', marginBottom:'2.5rem' }}>
          {sessionPin && (
            <div style={{ background:'white', padding:'1.25rem', borderRadius:'20px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
              <QRCodeSVG value={playerUrl} size={180} bgColor="#ffffff" fgColor="#0a0a0f" level="H" />
            </div>
          )}
          <div className="glass animate-fadeIn" style={{ borderRadius:'16px', padding:'1.5rem', minWidth:'280px' }}>
            <p style={{ color:'var(--text3)', fontSize:'0.8rem', fontFamily:'Syne, sans-serif', marginBottom:'0.75rem' }}>JUGADORES CONECTADOS</p>
            <p style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'3rem', color:'var(--text)', lineHeight:1, marginBottom:'1rem' }}>{players.length}</p>
            <div style={{ maxHeight:'160px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {players.map(p => (
                <div key={p.id} className="animate-slideIn" style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0.6rem', background:'var(--surface)', borderRadius:'8px' }}>
                  <span style={{ fontSize:'1rem' }}>{p.avatar ?? '🎮'}</span>
                  <span style={{ fontSize:'0.9rem', color:'var(--text2)', fontWeight:500 }}>{p.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginBottom:'1rem' }}>
          Jugadores: <strong style={{ color:'var(--accent2)' }}>{window.location.origin}</strong>
        </p>
        <button className="btn-primary" onClick={sendNextQuestion} disabled={players.length===0} style={{ padding:'1rem 3rem', fontSize:'1.1rem', borderRadius:'16px' }}>
          {players.length===0 ? 'Esperando jugadores...' : `▶ Comenzar con ${players.length} jugador${players.length!==1?'es':''}`}
        </button>
      </div>
    )
  }

  if (phase==='question' && currentQ) {
    const radius=54, circ=2*Math.PI*radius
    const progress = circ - (timeLeft/(currentQ.timeLimit??20))*circ
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
        <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0.75rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, color:'var(--text2)', fontSize:'0.9rem' }}>Pregunta {currentQ.index+1} / {currentQ.totalQuestions}</span>
            <div style={{ width:'200px', height:'6px', background:'var(--border)', borderRadius:'3px' }}>
              <div style={{ width:`${((currentQ.index+1)/currentQ.totalQuestions)*100}%`, height:'100%', background:'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius:'3px', transition:'width 0.5s' }} />
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ background:'var(--surface2)', padding:'0.25rem 0.75rem', borderRadius:'20px', fontSize:'0.8rem', color:'var(--accent2)', fontWeight:600 }}>PIN: {sessionPin}</span>
            <span style={{ background: answerCount.answered === answerCount.total && answerCount.total > 0 ? 'rgba(16,185,129,0.15)' : 'var(--surface2)', border: `1px solid ${answerCount.answered === answerCount.total && answerCount.total > 0 ? 'var(--green)' : 'var(--border)'}`, padding:'0.25rem 0.75rem', borderRadius:'20px', fontSize:'0.8rem', color: answerCount.answered === answerCount.total && answerCount.total > 0 ? 'var(--green)' : 'var(--text2)', fontWeight:600, transition:'all 0.3s' }}>
              ✍️ {answerCount.answered}/{answerCount.total} respondieron
            </span>
          </div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', gap:'2rem' }}>
          <div style={{ position:'relative', width:'130px', height:'130px' }}>
            <svg width="130" height="130" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle cx="65" cy="65" r={radius} fill="none" stroke={timeLeft<=5?'var(--red)':timeLeft<=10?'var(--yellow)':'var(--accent2)'} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={progress} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s linear, stroke 0.3s' }} />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2.25rem', color:timeLeft<=5?'var(--red)':'var(--text)' }}>{timeLeft}</div>
          </div>
          <div className="glass animate-popIn" style={{ borderRadius:'20px', padding:'2rem 3rem', maxWidth:'800px', textAlign:'center' }}>
            {currentQ.question?.mediaUrl && <img src={currentQ.question.mediaUrl} alt="" style={{ maxHeight:'200px', borderRadius:'12px', marginBottom:'1rem', objectFit:'cover' }} />}
            <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.75rem', lineHeight:1.3 }}>{currentQ.question?.questionText}</h2>
            <div style={{ display:'flex', gap:'1rem', justifyContent:'center', marginTop:'1rem' }}>
              <span style={{ color:'var(--text3)', fontSize:'0.85rem' }}>{currentQ.question?.points??1000} pts</span>
              <span style={{ color:'var(--text3)', fontSize:'0.85rem', textTransform:'capitalize' }}>·</span>
              <span style={{ color:'var(--text3)', fontSize:'0.85rem', textTransform:'capitalize' }}>{currentQ.question?.type?.replace(/_/g,' ')}</span>
            </div>
          </div>
          {currentQ.question?.options && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.75rem', width:'100%', maxWidth:'700px' }}>
              {currentQ.question.options.map((opt, i) => (
                <div key={opt.id} style={{ background:ANSWER_COLORS[i%4], borderRadius:'14px', padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <span style={{ fontSize:'1.1rem', color:'white' }}>{ANSWER_ICONS[i%4]}</span>
                  <span style={{ color:'white', fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:'0.95rem' }}>{opt.optionText}</span>
                  {opt.isCorrect && <span style={{ marginLeft:'auto' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
          <button className="btn-primary" onClick={sendShowResults} style={{ padding:'0.875rem 2.5rem' }}>Mostrar resultados →</button>
        </div>
      </div>
    )
  }

  if (phase==='results' && qStats) {
    const sortedPlayers = [...players].sort((a,b)=>b.score-a.score).slice(0,5)
    
    // OBTENER EL TIPO DE PREGUNTA ACTUAL
    const qType = currentQ?.question?.type

    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', gap:'2rem' }}>
        <div className="animate-popIn" style={{ textAlign:'center' }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2rem', marginBottom:'0.5rem' }}>Resultados</h2>
          <p style={{ color:'var(--text3)', fontSize:'0.9rem' }}>{qStats.correctAnswers} de {qStats.totalAnswers} respuestas correctas{qStats.totalAnswers>0?` (${Math.round(qStats.correctAnswers/qStats.totalAnswers*100)}%)`:''}</p>
        </div>

        {/* =======================================================
            NUEVA SECCIÓN: PANEL DE SOLUCIÓN CORRECTA PARA PUZZLE
           ======================================================= */}
        {qType === 'puzzle' && currentQ?.question?.options && (
          <div className="glass animate-fadeIn" style={{ borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'600px', border:'1px solid var(--green)' }}>
            <p style={{ fontFamily:'Syne, sans-serif', fontWeight:700, color:'var(--green)', fontSize:'0.85rem', marginBottom:'1rem', letterSpacing:'0.05em' }}>
              ✨ ORDEN CORRECTO DE LA SOLUCIÓN
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {[...currentQ.question.options]
                // Ordenamos numéricamente si existe el campo .order o .correctOrder. 
                // Si no existe, asume que el array original del backend ya venía bien estructurado.
                .sort((a, b) => (a.order ?? a.correctOrder ?? 0) - (b.order ?? b.correctOrder ?? 0))
                .map((opt, idx) => (
                  <div 
                    key={opt.id} 
                    style={{ 
                      background:'var(--surface)', 
                      padding:'0.75rem 1rem', 
                      borderRadius:'10px', 
                      display:'flex', 
                      alignItems:'center', 
                      gap:'0.75rem',
                      border:'1px solid var(--border)'
                    }}
                  >
                    <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, color:'var(--accent2)', minWidth:'24px' }}>
                      {idx + 1}.
                    </span>
                    <span style={{ color:'var(--text)', fontSize:'0.95rem', fontWeight:500 }}>
                      {opt.optionText ?? opt.option_text}
                    </span>
                    <span style={{ marginLeft:'auto', color:'var(--green)' }}>✓</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Retroalimentación de la pregunta */}
        {explanation && (
          <div className="animate-fadeIn glass" style={{ borderRadius:'14px', padding:'1rem 1.5rem', width:'100%', maxWidth:'600px', borderColor:'rgba(124,58,237,0.3)', background:'rgba(124,58,237,0.08)' }}>
            <p style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'0.8rem', color:'var(--accent2)', marginBottom:'0.4rem', letterSpacing:'0.05em' }}>💡 RETROALIMENTACIÓN</p>
            <p style={{ color:'var(--text2)', fontSize:'0.95rem', lineHeight:1.5 }}>{explanation}</p>
          </div>
        )}

        {qStats.distribution && qStats.distribution.length > 0 && (() => {
          const isOpenType = ['word_cloud','brainstorm','type_answer'].includes(qType)

          if (isOpenType) {
            // Nube de palabras / respuestas abiertas
            const maxCount = Math.max(...qStats.distribution.map(d => d.count), 1)
            return (
              <div className="glass animate-fadeIn" style={{ borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'700px' }}>
                <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, color:'var(--text2)', fontSize:'0.85rem', marginBottom:'1.25rem' }}>
                  {qType === 'word_cloud' ? '☁️ NUBE DE PALABRAS' : '💡 RESPUESTAS RECIBIDAS'}
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem', justifyContent:'center', minHeight:'80px', alignItems:'center' }}>
                  {qStats.distribution.map((d, i) => {
                    const scale = 0.7 + (d.count / maxCount) * 1.1
                    const colors = ['var(--accent2)','var(--green)','var(--yellow)','var(--blue)','var(--pink)','var(--orange)']
                    return (
                      <div key={i} className="animate-popIn" style={{ animationDelay:`${i*0.08}s`, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem' }}>
                        <span style={{ fontSize:`${scale}rem`, fontFamily:'Syne, sans-serif', fontWeight:700, color: colors[i % colors.length], lineHeight:1.2, textTransform:'capitalize' }}>
                          {d.label}
                        </span>
                        <span style={{ fontSize:'0.7rem', color:'var(--text3)', background:'var(--surface2)', padding:'0.1rem 0.4rem', borderRadius:'10px' }}>
                          {d.count}×
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          // Tipos con opciones: barras normales (Ocultar si es puzzle para no saturar la pantalla)
          if (qType === 'puzzle') return null

          return (
            <div className="glass animate-fadeIn" style={{ borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'600px' }}>
              <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, color:'var(--text2)', fontSize:'0.85rem', marginBottom:'1rem' }}>DISTRIBUCIÓN DE RESPUESTAS</p>
              {qStats.distribution.map((d,i) => (
                <div key={i} style={{ marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                    <span style={{ fontSize:'0.9rem', color:'var(--text2)' }}>{d.label}</span>
                    <span style={{ fontSize:'0.85rem', color:'var(--text3)' }}>{d.count} ({d.pct}%)</span>
                  </div>
                  <div style={{ height:'8px', background:'var(--border)', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${d.pct}%`, height:'100%', background:d.isCorrect?'var(--green)':ANSWER_COLORS[i%4], borderRadius:'4px', transition:'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <div className="glass animate-fadeIn" style={{ borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'600px' }}>
          <p style={{ fontFamily:'Syne, sans-serif', fontWeight:600, color:'var(--text2)', fontSize:'0.85rem', marginBottom:'1rem' }}>CLASIFICACIÓN</p>
          {sortedPlayers.map((p,i) => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem', borderRadius:'10px', marginBottom:'0.4rem', background:i===0?'rgba(251,191,36,0.1)':'transparent' }}>
              <span style={{ fontFamily:'Syne, sans-serif', fontWeight:800, color:['#fbbf24','#d1d5db','#cd7c2f'][i]??'var(--text3)', width:'24px', textAlign:'center' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
              <span style={{ flex:1, color:'var(--text)', fontWeight:500 }}>{p.nickname}</span>
              <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, color:'var(--accent2)' }}>{p.score?.toLocaleString()??0}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'1rem' }}>
          <button className="btn-primary" onClick={sendNextQuestion} style={{ padding:'0.875rem 2.5rem' }}>Siguiente pregunta →</button>
          <button className="btn-ghost" onClick={sendEndGame}>Terminar juego</button>
        </div>
      </div>
    )
  }

  if (phase==='podium'||phase==='finished') {
    const top3 = [...players].sort((a,b)=>b.score-a.score).slice(0,3)
    const order=[1,0,2]
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0a0a0f 0%,#1a0a2e 50%,#0a0a1a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 60%, rgba(124,58,237,0.2) 0%, transparent 65%)', pointerEvents:'none' }} />
        <h1 className="animate-bounceIn" style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'3rem', textAlign:'center', marginBottom:'3rem', background:'linear-gradient(135deg,#fbbf24,#f97316)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          🏆 Podio Final
        </h1>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'1.5rem', marginBottom:'3rem' }}>
          {order.map(rank => {
            const player=top3[rank]
            if(!player) return <div key={rank} style={{ width:'160px' }} />
            const heights=['200px','260px','170px']
            const medals=['🥈','🥇','🥉']
            const bgColors=['rgba(209,213,219,0.15)','rgba(251,191,36,0.2)','rgba(205,124,47,0.15)']
            return (
              <div key={rank} className="animate-popIn" style={{ animationDelay:`${rank*0.2}s`, textAlign:'center', width:'160px' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>{player.avatar??'🎮'}</div>
                <p style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1rem', marginBottom:'0.25rem' }}>{player.nickname}</p>
                <p style={{ color:'var(--accent2)', fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.2rem', marginBottom:'0.75rem' }}>{player.score?.toLocaleString()}</p>
                <div style={{ height:heights[rank], background:bgColors[rank], border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px 12px 0 0', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'1rem', fontSize:'2rem' }}>{medals[rank]}</div>
              </div>
            )
          })}
        </div>
        <button className="btn-primary" onClick={() => navigate(`/admin/results/${sessionId}`)} style={{ padding:'1rem 3rem', fontSize:'1rem', borderRadius:'14px' }}>
          Ver resultados completos →
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="animate-spin" style={{ width:'48px', height:'48px', border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%' }} />
    </div>
  )
}
