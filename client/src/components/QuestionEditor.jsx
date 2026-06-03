import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { API_URL } from '../config'

import toast from 'react-hot-toast'

const QUESTION_TYPES = {
  multiple_choice: 'Opción múltiple',
  true_false:      'Verdadero / Falso',
  type_answer:     'Escribir respuesta',
  puzzle:          'Puzzle (ordenar)',
  poll:            'Encuesta',
  word_cloud:      'Nube de palabras',
  slider:          'Deslizador numérico',
  brainstorm:      'Brainstorm',
  drop_pin:        'Señalar en imagen',
  matching:        'Emparejar'
}

function defaultOptions(type) {
  if (type === 'true_false') return [
    { text: 'Verdadero', is_correct: true,  position: 0, match_group: 'A' },
    { text: 'Falso',     is_correct: false, position: 1, match_group: 'A' }
  ]
  if (type === 'matching') return [
    { text: '', is_correct: false, position: 0, match_group: 'A' },
    { text: '', is_correct: false, position: 0, match_group: 'B' },
    { text: '', is_correct: false, position: 1, match_group: 'A' },
    { text: '', is_correct: false, position: 1, match_group: 'B' }
  ]
  if (['multiple_choice', 'puzzle', 'poll'].includes(type)) return [
    { text: '', is_correct: false, position: 0, match_group: 'A' },
    { text: '', is_correct: false, position: 1, match_group: 'A' }
  ]
  return []
}

export default function QuestionEditor({ quizId, question = null, authHeaders, onSaved = () => {}, onCancel = () => {} }) {
  const isFirstRender = useRef(true)

  const [type,          setType]          = useState(question?.type || 'multiple_choice')
  const [text,          setText]          = useState(question?.question_text || '')
  const [timeLimit,     setTimeLimit]     = useState(question?.time_limit_sec || 20)
  const [points,        setPoints]        = useState(question?.points || 1000)
  const [mediaUrl,      setMediaUrl]      = useState(question?.media_url || '')
  const [sliderMin,     setSliderMin]     = useState(question?.slider_min ?? 0)
  const [sliderMax,     setSliderMax]     = useState(question?.slider_max ?? 100)
  const [sliderCorrect, setSliderCorrect] = useState(question?.slider_correct ?? '')
  const [pinX,          setPinX]          = useState(question?.pin_x ?? '')
  const [pinY,          setPinY]          = useState(question?.pin_y ?? '')
  const [loading,       setLoading]       = useState(false)
  const [explanation,   setExplanation]   = useState(question?.explanation || '')

  const [options, setOptions] = useState(() => {
    const raw = question?.question_options ?? question?.options ?? []
    return raw.length
      ? raw.map((opt, i) => ({
          id:          opt.id,
          text:        opt.option_text ?? opt.optionText ?? opt.text ?? '',
          is_correct:  !!(opt.is_correct ?? opt.isCorrect),
          position:    opt.position ?? i,
          match_group: opt.match_group ?? opt.matchGroup ?? 'A'
        }))
      : defaultOptions(question?.type || 'multiple_choice')
  })

  // Resetear opciones SOLO cuando el usuario cambia el tipo manualmente (no en el primer render)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setOptions(defaultOptions(type))
  }, [type])

  const addOption = () => setOptions(prev => {
    if (type === 'matching') {
      // Agregar siempre un par completo A+B con el mismo índice de par
      const pairIndex = Math.max(...prev.map(o => o.position ?? 0), -1) + 1
      return [
        ...prev,
        { text: '', is_correct: false, position: pairIndex, match_group: 'A' },
        { text: '', is_correct: false, position: pairIndex, match_group: 'B' }
      ]
    }
    return [...prev, { text: '', is_correct: false, position: prev.length, match_group: 'A' }]
  })

  const removeOption = (idx) => setOptions(prev => prev.filter((_, i) => i !== idx))

  const changeOption = (idx, field, value) => setOptions(prev => {
    const next = [...prev]
    next[idx] = { ...next[idx], [field]: value }
    return next
  })

  const handleSave = async () => {
    if (!text.trim()) { toast.error('La pregunta no puede estar vacía'); return }

    const needsOptions = ['multiple_choice', 'true_false', 'puzzle', 'matching', 'poll'].includes(type)
    const validOptions = options.filter(o => o.text.trim())
    if (needsOptions && validOptions.length === 0) {
      toast.error('Debes añadir al menos una opción válida')
      return
    }

    setLoading(true)
    try {
      const payload = {
        type,
        question_text:  text.trim(),
        time_limit_sec: timeLimit,
        points,
        media_url:      mediaUrl || null,
        explanation:    explanation.trim() || null,
        ...(type === 'slider' && {
          slider_min:     Number(sliderMin),
          slider_max:     Number(sliderMax),
          slider_correct: sliderCorrect !== '' ? Number(sliderCorrect) : null
        }),
        ...(type === 'drop_pin' && {
          pin_x: pinX !== '' ? Number(pinX) : null,
          pin_y: pinY !== '' ? Number(pinY) : null
        }),
        question_options: needsOptions
          ? validOptions.map((o, idx) => ({
              option_text: o.text.trim(),
              is_correct:  !!o.is_correct,
              // Para matching usar el position real (define el par). Para otros tipos usar idx
              position:    type === 'matching' ? (o.position ?? idx) : idx,
              match_group: type === 'matching' ? (o.match_group || 'A') : null
            }))
          : []
      }

      const res = await fetch(
        question ? `${API_URL}/api/questions/${question.id}` : `${API_URL}/api/quizzes/${quizId}/questions`,
        { method: question ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) }
      )
      if (!res.ok) throw new Error((await res.json()).error || 'Error guardando pregunta')
      toast.success(question ? 'Pregunta actualizada ✓' : 'Pregunta creada ✓')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', zIndex:50 }}>
      <div className="card animate-popIn" style={{ width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.25rem' }}>
            {question ? '✏️ Editar Pregunta' : '➕ Nueva Pregunta'}
          </h2>
          <button onClick={onCancel} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo de pregunta</label>
            <select value={type} onChange={e => setType(e.target.value)} className="input-field" style={{ fontSize:'0.9rem' }}>
              {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Texto */}
          <div>
            <label style={labelStyle}>Pregunta</label>
            <textarea value={text} onChange={e => setText(e.target.value)} className="input-field" rows="3"
              placeholder="Escribe la pregunta..." style={{ fontSize:'0.9rem', fontFamily:'DM Sans, sans-serif', resize:'vertical' }} />
          </div>

          {/* Tiempo y Puntos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div>
              <label style={labelStyle}>Tiempo (segundos)</label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="input-field" min="5" max="300" />
            </div>
            <div>
              <label style={labelStyle}>Puntos</label>
              <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="input-field" min="0" />
            </div>
          </div>

          {/* Media URL */}
          <div>
            <label style={labelStyle}>URL de imagen / video (opcional)</label>
            <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="input-field" placeholder="https://..." />
            {mediaUrl && <img src={mediaUrl} alt="preview" onError={e => e.target.style.display='none'} style={{ marginTop:'0.5rem', maxHeight:'120px', borderRadius:'8px', objectFit:'cover' }} />}
          </div>

          {/* Explicación / retroalimentación */}
          <div>
            <label style={labelStyle}>Retroalimentación (opcional)</label>
            <textarea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              className="input-field"
              rows="2"
              placeholder="Explica por qué la respuesta es correcta. Se mostrará al jugador después de responder."
              style={{ fontSize:'0.9rem', fontFamily:'DM Sans, sans-serif', resize:'vertical' }}
            />
          </div>

          {/* Slider */}
          {type === 'slider' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div>
                <label style={labelStyle}>Valor mínimo</label>
                <input type="number" value={sliderMin} onChange={e => setSliderMin(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={labelStyle}>Valor máximo</label>
                <input type="number" value={sliderMax} onChange={e => setSliderMax(e.target.value)} className="input-field" />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>Valor correcto</label>
                <input type="number" value={sliderCorrect} onChange={e => setSliderCorrect(e.target.value)} className="input-field"
                  placeholder={`Entre ${sliderMin} y ${sliderMax}`} min={sliderMin} max={sliderMax} />
              </div>
            </div>
          )}

          {/* Drop Pin */}
          {type === 'drop_pin' && (
            <div>
              <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginBottom:'0.75rem' }}>
                Haz clic en la imagen para definir el punto correcto. También puedes ajustar las coordenadas manualmente.
              </p>
              {mediaUrl && (
                <div style={{ position:'relative', marginBottom:'1rem', cursor:'crosshair', userSelect:'none' }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1)
                    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1)
                    setPinX(x); setPinY(y)
                  }}
                >
                  <img src={mediaUrl} alt="Haz clic para marcar"
                    style={{ width:'100%', maxHeight:'320px', objectFit:'contain', borderRadius:'12px', border:'2px solid var(--accent)', display:'block' }}
                    draggable={false}
                  />
                  {pinX !== '' && pinY !== '' && (
                    <>
                      {/* Cruz de referencia */}
                      <div style={{ position:'absolute', left:`${pinX}%`, top:`${pinY}%`, transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
                        <div style={{ width:'30px', height:'2px', background:'rgba(255,255,255,0.6)', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
                        <div style={{ width:'2px', height:'30px', background:'rgba(255,255,255,0.6)', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
                      </div>
                      {/* Pin */}
                      <div style={{ position:'absolute', left:`${pinX}%`, top:`${pinY}%`, transform:'translate(-50%,-50%)', width:'20px', height:'20px', background:'var(--accent2)', border:'3px solid white', borderRadius:'50%', boxShadow:'0 2px 8px rgba(0,0,0,0.5)', pointerEvents:'none' }} />
                      {/* Área de tolerancia visual (radio 10% = tolerancia del servidor) */}
                      <div style={{ position:'absolute', left:`${pinX}%`, top:`${pinY}%`, transform:'translate(-50%,-50%)', width:'20%', height:'0', paddingBottom:'20%', border:'2px dashed rgba(168,85,247,0.6)', borderRadius:'50%', pointerEvents:'none', background:'rgba(168,85,247,0.05)' }} />
                    </>
                  )}
                  <p style={{ position:'absolute', bottom:'8px', right:'8px', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'0.75rem', padding:'0.25rem 0.5rem', borderRadius:'6px', margin:0 }}>
                    Haz clic para marcar el punto correcto
                  </p>
                </div>
              )}
              {!mediaUrl && (
                <div style={{ border:'2px dashed var(--border)', borderRadius:'12px', padding:'2rem', textAlign:'center', color:'var(--text3)', fontSize:'0.85rem', marginBottom:'1rem' }}>
                  📷 Agrega una URL de imagen arriba para poder marcar el punto
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={labelStyle}>X ({pinX !== '' ? pinX+'%' : '—'})</label>
                  <input type="number" value={pinX} onChange={e => setPinX(e.target.value)} className="input-field" min="0" max="100" step="0.1" placeholder="0 - 100" />
                </div>
                <div>
                  <label style={labelStyle}>Y ({pinY !== '' ? pinY+'%' : '—'})</label>
                  <input type="number" value={pinY} onChange={e => setPinY(e.target.value)} className="input-field" min="0" max="100" step="0.1" placeholder="0 - 100" />
                </div>
              </div>
            </div>
          )}

          {/* Información de tipos abiertos */}
          {['type_answer', 'word_cloud', 'brainstorm'].includes(type) && (
            <div style={{ background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:'10px', padding:'0.875rem', fontSize:'0.85rem', color:'var(--text2)' }}>
              {type === 'type_answer'  && '💡 Los jugadores escriben su respuesta. Puedes agregar la respuesta correcta en opciones para evaluación automática.'}
              {type === 'word_cloud'   && '☁️ Los jugadores envían palabras que se agrupan en una nube visual. No tiene respuesta correcta.'}
              {type === 'brainstorm'   && '💡 Los jugadores envían ideas libremente. No tiene respuesta correcta.'}
            </div>
          )}

          {/* Opciones para type_answer (respuesta correcta) */}
          {type === 'type_answer' && (
            <div>
              <label style={labelStyle}>Respuesta correcta (para evaluación automática)</label>
              <input
                type="text"
                value={options[0]?.text || ''}
                onChange={e => setOptions([{ text: e.target.value, is_correct: true, position: 0, match_group: 'A' }])}
                className="input-field"
                placeholder="Escribe la respuesta esperada..."
              />
            </div>
          )}

          {/* Opciones para tipos con lista */}
          {['multiple_choice', 'true_false', 'puzzle', 'matching', 'poll'].includes(type) && (
            <div>
              <label style={labelStyle}>
                {type === 'matching' ? 'Pares para emparejar' : type === 'puzzle' ? 'Elementos en orden correcto' : 'Opciones de respuesta'}
              </label>

              {type === 'matching' && (
                <p style={{ fontSize:'0.8rem', color:'var(--text3)', marginBottom:'0.5rem' }}>
                  Asigna cada elemento a Columna A o Columna B. Los pares con el mismo índice de posición se consideran correctos.
                </p>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={e => changeOption(idx, 'text', e.target.value)}
                      className="input-field"
                      placeholder={type === 'true_false' ? '' : type === 'matching' ? `Elemento ${idx + 1}` : `Opción ${idx + 1}`}
                      style={{ flex:1, fontSize:'0.9rem' }}
                      disabled={type === 'true_false'}
                    />

                    {type === 'matching' && (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
                        <span style={{ fontSize:'0.8rem', color: opt.match_group==='A' ? 'var(--accent2)' : 'var(--green)', fontWeight:700, minWidth:'16px' }}>
                          {opt.match_group}
                        </span>
                        <span style={{ fontSize:'0.72rem', color:'var(--text3)', background:'var(--surface2)', padding:'0.15rem 0.5rem', borderRadius:'6px', whiteSpace:'nowrap' }}>
                          Par {(opt.position ?? 0) + 1}
                        </span>
                      </div>
                    )}

                    {['multiple_choice', 'true_false', 'poll'].includes(type) && (
                      <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.85rem', whiteSpace:'nowrap', cursor:'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!opt.is_correct}
                          onChange={e => changeOption(idx, 'is_correct', e.target.checked)}
                          style={{ accentColor:'var(--accent)', width:'16px', height:'16px' }}
                          disabled={type === 'poll'}
                        />
                        <span style={{ color: opt.is_correct ? 'var(--green)' : 'var(--text3)' }}>✓</span>
                      </label>
                    )}

                    {type !== 'true_false' && options.length > 1 && (
                      <button onClick={() => removeOption(idx)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'0.4rem 0.6rem', cursor:'pointer', color:'var(--red)', fontSize:'0.8rem' }}>
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {type !== 'true_false' && options.length < (type === 'matching' ? 8 : 4) && (
                <button onClick={addOption} style={{ marginTop:'0.6rem', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'0.9rem', fontWeight:600, padding:0 }}>
                  + Agregar opción
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.75rem' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex:1 }}>Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary" style={{ flex:1 }}>
            {loading ? '⏳ Guardando...' : question ? '✓ Actualizar' : '✓ Crear pregunta'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text2)',
  marginBottom: '0.5rem'
}
