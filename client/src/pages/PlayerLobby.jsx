import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { useWebSocket, buildWsUrl } from '../hooks/useWebSocket.js'
import { useGameState } from '../hooks/useGameState.js'
import toast from 'react-hot-toast'
import MultipleChoice from '../components/QuestionTypes/MultipleChoice.jsx'
import TrueFalse      from '../components/QuestionTypes/TrueFalse.jsx'
import TypeAnswer     from '../components/QuestionTypes/TypeAnswer.jsx'
import Slider         from '../components/QuestionTypes/Slider.jsx'
import Poll           from '../components/QuestionTypes/Poll.jsx'
import WordCloud      from '../components/QuestionTypes/WordCloud.jsx'
import Brainstorm     from '../components/QuestionTypes/Brainstorm.jsx'
import DropPin        from '../components/QuestionTypes/DropPin.jsx'
import Matching       from '../components/QuestionTypes/Matching.jsx'
import Puzzle         from '../components/QuestionTypes/Puzzle.jsx'

const AVATARS = ['🦊','🐺','🦁','🐯','🦄','🐉','🦅','🐬','🦋','🦎','🐙','🦑','🐸','🦝','🐼','🦘']

// Tipos que NO cambian de pantalla inmediatamente — esperan feedback del servidor
const OPEN_TYPES = ['brainstorm', 'word_cloud', 'type_answer']

export default function PlayerLobby() {
  const { phase, setPhase, currentQ, session, setSession } = useGame()
  const { handleWsMessage } = useGameState()

  const [step, setStep]               = useState('pin')
  const [pin, setPin]                 = useState(() => new URLSearchParams(window.location.search).get('pin') || '')
  const [nickname, setNickname]       = useState('')
  const [avatar, setAvatar]           = useState(() => AVATARS[Math.floor(Math.random()*AVATARS.length)])
  const [playerId, setPlayerId]       = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [myAnswer, setMyAnswer]       = useState(null)
  const [correct, setCorrect]         = useState(null)
  const [pointsEarned, setPointsEarned] = useState(null)
  const [myRank, setMyRank]           = useState(null)
  const [loading, setLoading]         = useState(false)

  const wsUrl = playerId && session
    ? buildWsUrl(`/ws?role=player&sessionId=${session.id}&playerId=${playerId}`)
    : null

  const { send } = useWebSocket({
    url: wsUrl,
    enabled: !!wsUrl,
    onMessage: (msg) => {
      handleWsMessage(msg)
      switch (msg.type) {
        case 'QUESTION':
          setAnswered(false); setMyAnswer(null); setCorrect(null); setPointsEarned(null)
          setStep('game')
          break
        case 'ANSWER_RECEIVED':
          // Solo confirmación de recepción — aún no sabemos si es correcto
          setStep('answered')
          break

        case 'ANSWER_FEEDBACK':
          // Llega cuando el admin presiona "Mostrar resultados" — ahora sí revelamos
          setCorrect(msg.isCorrect)
          setPointsEarned(msg.pointsEarned)
          setMyRank(msg.rank)
          setStep('answered')
          break
        case 'QUESTION_RESULTS':
          if (step !== 'answered') setStep('answered')
          break
        case 'GAME_FINISHED':
        case 'PODIUM':
          setStep('finished')
          break
        default:
          break
      }
    }
  })

  useEffect(() => {
    const urlPin = new URLSearchParams(window.location.search).get('pin')
    if (urlPin) setPin(urlPin)
  }, [])

  async function joinGame(e) {
    e.preventDefault()
    if (!pin || !nickname) return
    setLoading(true)
    try {
      const res  = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim(), nickname: nickname.trim(), avatar })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession(data.session)
      setPlayerId(data.player.id)
      setPhase('lobby')
      setStep('waiting')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildAnswerPayload = (answer) => {
    const qType   = currentQ?.question?.type
    const payload = { type: 'ANSWER', answeredAt: Date.now() }
    switch (qType) {
      case 'multiple_choice':
      case 'true_false':
      case 'poll':
        return { ...payload, answerOptionId: answer }
      case 'slider':
        return { ...payload, answerNumeric: answer }
      case 'drop_pin':
        return { ...payload, answerPinX: answer.x, answerPinY: answer.y }
      case 'type_answer':
      case 'brainstorm':
        return { ...payload, answerText: String(answer).trim() }
      case 'word_cloud':
      case 'matching':
      case 'puzzle':
        return { ...payload, answerText: typeof answer === 'string' ? answer : JSON.stringify(answer) }
      default:
        return { ...payload, answerText: typeof answer === 'string' ? answer : JSON.stringify(answer) }
    }
  }

  const sendQuestionAnswer = (answer) => {
    if (answered) return
    const payload = buildAnswerPayload(answer)
    const qType   = currentQ?.question?.type
    setAnswered(true)
    setMyAnswer(payload.answerOptionId ?? payload.answerText ?? payload.answerNumeric ?? null)
    send(payload)
    // Tipos abiertos: esperan ANSWER_FEEDBACK del servidor antes de cambiar pantalla
    // Tipos de opción: cambian inmediatamente para feedback visual rápido
    if (!OPEN_TYPES.includes(qType)) {
      setStep('answered')
    }
  }

  // ─── PIN ───────────────────────────────────────────────────────────────────
  if (step === 'pin') return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
      <div className="animate-popIn" style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'0.75rem' }}>⚡</div>
          <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2rem' }}>Pathotrivia</h1>
          <p style={{ color:'var(--text3)', marginTop:'0.25rem', fontSize:'0.9rem' }}>Ingresa el PIN de la partida</p>
        </div>
        <div className="glass" style={{ borderRadius:'20px', padding:'2rem' }}>
          <input className="input-field" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="000000"
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,8))}
            style={{ fontSize:'2.5rem', textAlign:'center', fontFamily:'Syne, sans-serif', fontWeight:800, letterSpacing:'0.2em', marginBottom:'1rem', padding:'1rem' }} />
          <button className="btn-primary" style={{ width:'100%', padding:'0.875rem', fontSize:'1rem' }}
            onClick={() => { if (pin.length >= 4) setStep('name') }} disabled={pin.length < 4}>
            Continuar →
          </button>
        </div>
      </div>
    </div>
  )

  // ─── NAME + AVATAR ─────────────────────────────────────────────────────────
  if (step === 'name') return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div className="animate-popIn" style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>{avatar}</div>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.5rem' }}>¿Cómo te llamas?</h2>
        </div>
        <div className="glass" style={{ borderRadius:'20px', padding:'2rem' }}>
          <input className="input-field" type="text" placeholder="Tu apodo" value={nickname}
            onChange={e => setNickname(e.target.value.slice(0,20))}
            style={{ textAlign:'center', fontSize:'1.25rem', marginBottom:'1.5rem', fontFamily:'Syne, sans-serif', fontWeight:600 }}
            autoFocus maxLength={20} />
          <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginBottom:'0.75rem', textAlign:'center' }}>Elige tu avatar</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem', marginBottom:'1.5rem' }}>
            {AVATARS.map(av => (
              <button key={av} onClick={() => setAvatar(av)} style={{ fontSize:'1.75rem', padding:'0.5rem', borderRadius:'12px', border:`2px solid ${avatar===av?'var(--accent)':'transparent'}`, background:avatar===av?'rgba(124,58,237,0.15)':'var(--surface)', cursor:'pointer', transition:'all 0.15s' }}>
                {av}
              </button>
            ))}
          </div>
          <button className="btn-primary" style={{ width:'100%', padding:'0.875rem', fontSize:'1rem' }}
            onClick={joinGame} disabled={!nickname.trim() || loading}>
            {loading ? 'Uniéndome...' : `${avatar} ¡Unirme!`}
          </button>
          <button className="btn-ghost" style={{ width:'100%', marginTop:'0.5rem', padding:'0.5rem', fontSize:'0.85rem' }} onClick={() => setStep('pin')}>
            ← Cambiar PIN
          </button>
        </div>
      </div>
    </div>
  )

  // ─── WAITING ───────────────────────────────────────────────────────────────
  if (step === 'waiting') return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center' }}>
      <div className="animate-float" style={{ fontSize:'4rem', marginBottom:'1.5rem' }}>{avatar}</div>
      <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.75rem', marginBottom:'0.5rem' }}>{nickname}</h2>
      <p style={{ color:'var(--text2)', marginBottom:'2rem', fontSize:'0.95rem' }}>¡Conectado! Esperando que el anfitrión inicie...</p>
      <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:'10px', height:'10px', borderRadius:'50%', background:'var(--accent)', animation:`pulse 1.2s ease-in-out ${i*0.3}s infinite` }} />
        ))}
      </div>
      <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginTop:'3rem' }}>PIN: <strong style={{ color:'var(--accent2)' }}>{pin}</strong></p>
    </div>
  )

  // ─── GAME ──────────────────────────────────────────────────────────────────
  if (step === 'game' && currentQ) {
    const q            = currentQ.question
    const questionText = q?.questionText ?? q?.question_text
    const qType        = q?.type

    return (
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
        <div style={{ height:'4px', background:'var(--border)' }}>
          <div style={{ width:`${((currentQ.index+1)/currentQ.totalQuestions)*100}%`, height:'100%', background:'linear-gradient(90deg,var(--accent),var(--accent2))', transition:'width 0.5s' }} />
        </div>
        <div style={{ padding:'1.5rem 1rem', textAlign:'center', flex:'0 0 auto' }}>
          <p style={{ color:'var(--text3)', fontSize:'0.8rem', marginBottom:'0.5rem' }}>Pregunta {currentQ.index+1} / {currentQ.totalQuestions}</p>
          <p style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.1rem', color:'var(--text)', lineHeight:1.4 }}>{questionText}</p>
          {/* Indicador de enviado para tipos abiertos */}
          {answered && OPEN_TYPES.includes(qType) && (
            <p className="animate-fadeIn" style={{ color:'var(--accent2)', fontSize:'0.85rem', marginTop:'0.5rem', fontWeight:600 }}>
              ✓ Respuesta enviada — esperando resultados...
            </p>
          )}
        </div>
        <div style={{ flex:1, padding:'0 1rem 1.5rem', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:'0.75rem' }}>
          {qType === 'multiple_choice' && <MultipleChoice question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} myAnswer={myAnswer} />}
          {qType === 'true_false'      && <TrueFalse      question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} myAnswer={myAnswer} />}
          {qType === 'poll'            && <Poll           question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} myAnswer={myAnswer} />}
          {qType === 'type_answer'     && <TypeAnswer     question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'slider'          && <Slider         question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'brainstorm'      && <Brainstorm     question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'word_cloud'      && <WordCloud      question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'drop_pin'        && <DropPin        question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'matching'        && <Matching       question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {qType === 'puzzle'          && <Puzzle         question={q} onAnswer={sendQuestionAnswer} disabled={answered} answered={answered} />}
          {!['multiple_choice','true_false','poll','type_answer','slider','brainstorm','word_cloud','drop_pin','matching','puzzle'].includes(qType) && (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:'2rem' }}>
              <p>Responde en la pantalla principal</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── ANSWERED ──────────────────────────────────────────────────────────────
  if (step === 'answered') return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center' }}>
      <div className="animate-bounceIn" style={{ fontSize:'5rem', marginBottom:'1rem' }}>
        {correct===true ? '✅' : correct===false ? '❌' : '🔒'}
      </div>
      <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'1.75rem', marginBottom:'0.5rem' }}>
        {correct===true ? '¡Correcto!' : correct===false ? 'Incorrecto' : '¡Respuesta enviada!'}
      </h2>
      {correct === null && (
        <p style={{ color:'var(--text3)', fontSize:'0.9rem', marginTop:'0.25rem' }}>
          El resultado se revelará cuando acabe el tiempo
        </p>
      )}
      {pointsEarned != null && pointsEarned > 0 && (
        <p style={{ color:'var(--accent2)', fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2rem', marginTop:'0.5rem' }}>+{pointsEarned}</p>
      )}
      {myRank && correct !== null && (
        <p style={{ color:'var(--text3)', marginTop:'0.5rem', fontSize:'0.9rem' }}>Posición actual: #{myRank}</p>
      )}
      <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', marginTop:'2rem' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--accent)', animation:`pulse 1.2s ease-in-out ${i*0.3}s infinite` }} />
        ))}
      </div>
      <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginTop:'1rem' }}>
        {correct !== null ? 'Esperando siguiente pregunta...' : 'Esperando que el anfitrión revele los resultados...'}
      </p>
    </div>
  )

  // ─── FINISHED ──────────────────────────────────────────────────────────────
  if (step === 'finished') return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center' }}>
      <div className="animate-float" style={{ fontSize:'4rem', marginBottom:'1rem' }}>{avatar}</div>
      <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2.5rem', marginBottom:'0.5rem' }}>¡Fin del juego!</h1>
      <p style={{ color:'var(--text2)', marginBottom:'2rem' }}>Gracias por jugar, {nickname}</p>
      <button className="btn-primary" onClick={() => { setStep('pin'); setPin(''); setNickname(''); setPlayerId(null) }} style={{ padding:'0.875rem 2.5rem' }}>
        Jugar de nuevo
      </button>
    </div>
  )

  return null
}