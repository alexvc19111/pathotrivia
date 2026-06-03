import { useState, useEffect, useRef, useMemo } from 'react'
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

// Helper para generar IDs locales únicos sin colisionar con DB
const genLocalId = () => `local_${Math.random().toString(36).substr(2, 9)}`

function createDefaultOptions(type) {
  if (type === 'true_false') return [
    { id: genLocalId(), text: 'Verdadero', is_correct: true,  position: 0, match_group: 'A' },
    { id: genLocalId(), text: 'Falso',     is_correct: false, position: 1, match_group: 'A' }
  ]
  if (type === 'matching') return [
    { id: genLocalId(), text: '', is_correct: false, position: 0, match_group: 'A' },
    { id: genLocalId(), text: '', is_correct: false, position: 0, match_group: 'B' },
    { id: genLocalId(), text: '', is_correct: false, position: 1, match_group: 'A' },
    { id: genLocalId(), text: '', is_correct: false, position: 1, match_group: 'B' }
  ]
  if (['multiple_choice', 'puzzle', 'poll'].includes(type)) return [
    { id: genLocalId(), text: '', is_correct: false, position: 0, match_group: 'A' },
    { id: genLocalId(), text: '', is_correct: false, position: 1, match_group: 'A' }
  ]
  if (type === 'type_answer') return [
    { id: genLocalId(), text: '', is_correct: true, position: 0, match_group: 'A' }
  ]
  return []
}

export default function QuestionEditor({ quizId, question = null, authHeaders, onSaved = () => {}, onCancel = () => {} }) {
  const isFirstRender = useRef(true)

  // Estado maestro del formulario
  const [type, setType] = useState(question?.type || 'multiple_choice')
  const [text, setText] = useState(question?.question_text || '')
  const [timeLimit, setTimeLimit] = useState(question?.time_limit_sec || 20)
  const [points, setPoints] = useState(question?.points || 1000)
  const [mediaUrl, setMediaUrl] = useState(question?.media_url || '')
  const [explanation, setExplanation] = useState(question?.explanation || '')
  const [loading, setLoading] = useState(false)

  // Estados específicos por tipos de juego
  const [sliderData, setSliderData] = useState({
    min: question?.slider_min ?? 0,
    max: question?.slider_max ?? 100,
    correct: question?.slider_correct ?? ''
  })
  const [pinData, setPinData] = useState({
    x: question?.pin_x ?? '',
    y: question?.pin_y ?? ''
  })

  // Caché local por tipos reparado e hidratado correctamente
  const [optionsCache, setOptionsCache] = useState(() => {
    const currentType = question?.type || 'multiple_choice'
    const raw = question?.question_options ?? question?.options ?? []
    
    let initialOptions = raw.map((opt, i) => ({
      id: opt.id || genLocalId(),
      text: opt.option_text ?? opt.optionText ?? opt.text ?? '',
      is_correct: currentType === 'type_answer' ? true : !!(opt.is_correct ?? opt.isCorrect),
      position: opt.position ?? i,
      match_group: opt.match_group ?? opt.matchGroup ?? 'A'
    }))

    // REPARACIÓN CLAVE: Si es type_answer y vino vacío de la DB, le aseguramos su nodo de texto vacío
    if (currentType === 'type_answer' && initialOptions.length === 0) {
      initialOptions = createDefaultOptions('type_answer')
    } else if (initialOptions.length === 0) {
      initialOptions = createDefaultOptions(currentType)
    }

    return { [currentType]: initialOptions }
  })

  // El estado activo de opciones lee directamente del tipo seleccionado en la caché
  const currentOptions = useMemo(() => optionsCache[type] || [], [optionsCache, type])

  const setOptionsForCurrentType = (updater) => {
    setOptionsCache(prev => {
      const nextOptions = typeof updater === 'function' ? updater(prev[type] || []) : updater
      return { ...prev, [type]: nextOptions }
    })
  }

  // Inicializar tipos faltantes en caché al cambiar el Select
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!optionsCache[type]) {
      setOptionsCache(prev => ({ ...prev, [type]: createDefaultOptions(type) }))
    }
  }, [type, optionsCache])

  const handleAddOption = () => {
    setOptionsForCurrentType(prev => {
      if (type === 'matching') {
        const pairIndex = Math.max(...prev.map(o => o.position ?? 0), -1) + 1
        return [
          ...prev,
          { id: genLocalId(), text: '', is_correct: false, position: pairIndex, match_group: 'A' },
          { id: genLocalId(), text: '', is_correct: false, position: pairIndex, match_group: 'B' }
        ]
      }
      return [...prev, { id: genLocalId(), text: '', is_correct: false, position: prev.length, match_group: 'A' }]
    })
  }

  const handleRemoveOption = (id) => {
    setOptionsForCurrentType(prev => prev.filter(o => o.id !== id))
  }

  const handleChangeOption = (id, field, value) => {
    setOptionsForCurrentType(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const handleSave = async () => {
    if (!text.trim()) return toast.error('La pregunta no puede estar vacía')

    // Agregamos 'type_answer' a la validación de requerimientos mínimos
    const needsOptions = ['multiple_choice', 'true_false', 'puzzle', 'matching', 'poll', 'type_answer'].includes(type)
    const validOptions = currentOptions.filter(o => o.text.trim())
    
    if (needsOptions && validOptions.length === 0) {
      return toast.error('Debes añadir una respuesta correcta válida')
    }

    setLoading(true)
    try {
      const payload = {
        type,
        question_text: text.trim(),
        time_limit_sec: timeLimit,
        points,
        media_url: mediaUrl || null,
        explanation: explanation.trim() || null,
        ...(type === 'slider' && {
          slider_min: Number(sliderData.min),
          slider_max: Number(sliderData.max),
          slider_correct: sliderData.correct !== '' ? Number(sliderData.correct) : null
        }),
        ...(type === 'drop_pin' && {
          pin_x: pinData.x !== '' ? Number(pinData.x) : null,
          pin_y: pinData.y !== '' ? Number(pinData.y) : null
        }),
        // Re-estructuración del Payload enviado al Servidor
        question_options: type === 'type_answer' 
          ? [
              {
                ...(typeof currentOptions[0]?.id === 'number' && { id: currentOptions[0].id }),
                option_text: currentOptions[0]?.text.trim() || '',
                is_correct: true,
                position: 0,
                match_group: 'A'
              }
            ]
          : validOptions.map((o, idx) => ({
              ...(typeof o.id === 'number' && { id: o.id }), 
              option_text: o.text.trim(),
              is_correct: !!o.is_correct,
              position: type === 'matching' ? (o.position ?? idx) : idx,
              match_group: type === 'matching' ? (o.match_group || 'A') : null
            }))
      }

      const endpoint = question ? `${API_URL}/api/questions/${question.id}` : `${API_URL}/api/quizzes/${quizId}/questions`
      const res = await fetch(endpoint, {
        method: question ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      })
      
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
    <div style={styles.overlay}>
      <div className="card animate-popIn" style={styles.modal}>
        
        {/* Header */}
        <div style={styles.header}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.25rem' }}>
            {question ? '✏️ Editar Pregunta' : '➕ Nueva Pregunta'}
          </h2>
          <button onClick={onCancel} style={styles.closeBtn}><X size={20} /></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div>
            <label style={styles.label}>Tipo de pregunta</label>
            <select value={type} onChange={e => setType(e.target.value)} className="input-field" style={{ fontSize:'0.9rem' }}>
              {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label style={styles.label}>Pregunta</label>
            <textarea value={text} onChange={e => setText(e.target.value)} className="input-field" rows="3"
              placeholder="Escribe la pregunta..." style={{ fontSize:'0.9rem', fontFamily:'DM Sans, sans-serif', resize:'vertical' }} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div>
              <label style={styles.label}>Tiempo (segundos)</label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="input-field" min="5" max="300" />
            </div>
            <div>
              <label style={styles.label}>Puntos</label>
              <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="input-field" min="0" />
            </div>
          </div>

          <div>
            <label style={styles.label}>URL de imagen / video (opcional)</label>
            <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="input-field" placeholder="https://..." />
            {mediaUrl && <img src={mediaUrl} alt="preview" onError={e => e.target.style.display='none'} style={styles.mediaPreview} />}
          </div>

          <div>
            <label style={styles.label}>Retroalimentación (opcional)</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} className="input-field" rows="2"
              placeholder="Explica por qué la respuesta es correcta..." style={{ fontSize:'0.9rem', fontFamily:'DM Sans, sans-serif', resize:'vertical' }} />
          </div>

          {/* Sub-editores Condicionales Especiales */}
          {type === 'slider' && <SliderEditor data={sliderData} onChange={setSliderData} />}
          {type === 'drop_pin' && <DropPinEditor mediaUrl={mediaUrl} data={pinData} onChange={setPinData} />}
          
          {/* Alertas informativas de tipos abiertos */}
          {['type_answer', 'word_cloud', 'brainstorm'].includes(type) && (
            <div style={styles.infoBox}>
              {type === 'type_answer'  && '💡 Los jugadores escriben su respuesta. Puedes agregar la respuesta correcta abajo para evaluación automática.'}
              {type === 'word_cloud'   && '☁️ Los jugadores envían palabras que se agrupan en una nube visual. No tiene respuesta correcta.'}
              {type === 'brainstorm'   && '💡 Los jugadores envían ideas libremente. No tiene respuesta correcta.'}
            </div>
          )}

          {/* Renderizado Dinámico de Opciones de Entrada */}
          {type === 'type_answer' && (
            <div>
              <label style={styles.label}>Respuesta correcta (para evaluación automática)</label>
              <input 
                type="text" 
                value={currentOptions[0]?.text || ''} 
                onChange={e => setOptionsForCurrentType([{ id: currentOptions[0]?.id || genLocalId(), text: e.target.value, is_correct: true, position: 0, match_group: 'A' }])}
                className="input-field" 
                placeholder="Escribe la respuesta esperada..." 
              />
            </div>
          )}

          {['multiple_choice', 'true_false', 'puzzle', 'matching', 'poll'].includes(type) && (
            <OptionsList 
              type={type} 
              options={currentOptions} 
              onAdd={handleAddOption} 
              onRemove={handleRemoveOption} 
              onChange={handleChangeOption} 
            />
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

function SliderEditor({ data, onChange }) {
  const handleUpdate = (field, value) => onChange(prev => ({ ...prev, [field]: value }))
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
      <div>
        <label style={styles.label}>Valor mínimo</label>
        <input type="number" value={data.min} onChange={e => handleUpdate('min', e.target.value)} className="input-field" />
      </div>
      <div>
        <label style={styles.label}>Valor máximo</label>
        <input type="number" value={data.max} onChange={e => handleUpdate('max', e.target.value)} className="input-field" />
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <label style={styles.label}>Valor correcto</label>
        <input type="number" value={data.correct} onChange={e => handleUpdate('correct', e.target.value)} className="input-field" 
          placeholder={`Entre ${data.min} y ${data.max}`} min={data.min} max={data.max} />
      </div>
    </div>
  )
}

function DropPinEditor({ mediaUrl, data, onChange }) {
  if (!mediaUrl) {
    return (
      <div style={styles.pinEmptyState}>
        📷 Agrega una URL de imagen arriba para poder marcar el punto
      </div>
    )
  }

  const handleImageClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1)
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1)
    onChange({ x, y })
  }

  return (
    <div>
      <p style={{ color:'var(--text3)', fontSize:'0.85rem', marginBottom:'0.75rem' }}>
        Haz clic en la imagen para definir el punto correcto. También puedes ajustar las coordenadas manualmente.
      </p>
      <div style={styles.pinArea} onClick={handleImageClick}>
        <img src={mediaUrl} alt="Marcar destino" style={styles.pinImg} draggable={false} />
        {data.x !== '' && data.y !== '' && (
          <>
            <div style={{ ...styles.pinCrosshair, left:`${data.x}%`, top:`${data.y}%` }}>
              <div style={styles.crosshairH} />
              <div style={styles.crosshairV} />
            </div>
            <div style={{ ...styles.pinBubble, left:`${data.x}%`, top:`${data.y}%` }} />
            <div style={{ ...styles.pinTolerance, left:`${data.x}%`, top:`${data.y}%` }} />
          </>
        )}
        <p style={styles.pinImgBadge}>Haz clic para marcar el punto correcto</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div>
          <label style={styles.label}>X ({data.x !== '' ? data.x+'%' : '—'})</label>
          <input type="number" value={data.x} onChange={e => onChange(p => ({ ...p, x: e.target.value }))} className="input-field" min="0" max="100" step="0.1" />
        </div>
        <div>
          <label style={styles.label}>Y ({data.y !== '' ? data.y+'%' : '—'})</label>
          <input type="number" value={data.y} onChange={e => onChange(p => ({ ...p, y: e.target.value }))} className="input-field" min="0" max="100" step="0.1" />
        </div>
      </div>
    </div>
  )
}

function OptionsList({ type, options, onAdd, onRemove, onChange }) {
  const title = type === 'matching' ? 'Pares para emparejar' : type === 'puzzle' ? 'Elementos en orden correcto' : 'Opciones de respuesta'
  const maxLimit = type === 'matching' ? 8 : 4

  return (
    <div>
      <label style={styles.label}>{title}</label>
      {type === 'matching' && (
        <p style={{ fontSize:'0.8rem', color:'var(--text3)', marginBottom:'0.5rem' }}>
          Asigna cada elemento a Columna A o Columna B. Los pares con la misma posición coinciden correctamente.
        </p>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {options.map((opt, idx) => (
          <div key={opt.id} style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <input
              type="text"
              value={opt.text}
              onChange={e => onChange(opt.id, 'text', e.target.value)}
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
                <span style={styles.matchBadge}>
                  Par {(opt.position ?? 0) + 1}
                </span>
              </div>
            )}

            {['multiple_choice', 'true_false', 'poll'].includes(type) && (
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!!opt.is_correct}
                  onChange={e => onChange(opt.id, 'is_correct', e.target.checked)}
                  style={{ accentColor:'var(--accent)', width:'16px', height:'16px' }}
                  disabled={type === 'poll'}
                />
                <span style={{ color: opt.is_correct ? 'var(--green)' : 'var(--text3)' }}>✓</span>
              </label>
            )}

            {type !== 'true_false' && options.length > 1 && (
              <button onClick={() => onRemove(opt.id)} style={styles.removeBtn}>🗑</button>
            )}
          </div>
        ))}
      </div>

      {type !== 'true_false' && options.length < maxLimit && (
        <button onClick={onAdd} style={styles.addBtn}>+ Agregar opción</button>
      )}
    </div>
  )
}

/* --- MAPA DE ESTILOS CENTRALIZADO --- */
const styles = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', zIndex:50 },
  modal: { width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' },
  closeBtn: { background:'none', border:'none', cursor:'pointer', color:'var(--text3)' },
  label: { display:'block', fontSize:'0.85rem', fontWeight:600, color:'var(--text2)', marginBottom:'0.5rem' },
  mediaPreview: { marginTop:'0.5rem', maxHeight:'120px', borderRadius:'8px', objectFit:'cover' },
  infoBox: { background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:'10px', padding:'0.875rem', fontSize:'0.85rem', color:'var(--text2)' },
  pinEmptyState: { border:'2px dashed var(--border)', borderRadius:'12px', padding:'2rem', textAlign:'center', color:'var(--text3)', fontSize:'0.85rem', marginBottom:'1rem' },
  pinArea: { position:'relative', marginBottom:'1rem', cursor:'crosshair', userSelect:'none' },
  pinImg: { width:'100%', maxHeight:'320px', objectFit:'contain', borderRadius:'12px', border:'2px solid var(--accent)', display:'block' },
  pinImgBadge: { position:'absolute', bottom:'8px', right:'8px', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'0.75rem', padding:'0.25rem 0.5rem', borderRadius:'6px', margin:0 },
  pinCrosshair: { position:'absolute', transform:'translate(-50%,-50%)', pointerEvents:'none' },
  crosshairH: { width:'30px', height:'2px', background:'rgba(255,255,255,0.6)', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' },
  crosshairV: { width:'2px', height:'30px', background:'rgba(255,255,255,0.6)', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' },
  pinBubble: { position:'absolute', transform:'translate(-50%,-50%)', width:'20px', height:'20px', background:'var(--accent2)', border:'3px solid white', borderRadius:'50%', boxShadow:'0 2px 8px rgba(0,0,0,0.5)', pointerEvents:'none' },
  pinTolerance: { position:'absolute', transform:'translate(-50%,-50%)', width:'20%', height:'0', paddingBottom:'20%', border:'2px dashed rgba(168,85,247,0.6)', borderRadius:'50%', pointerEvents:'none', background:'rgba(168,85,247,0.05)' },
  matchBadge: { fontSize:'0.72rem', color:'var(--text3)', background:'var(--surface2)', padding:'0.15rem 0.5rem', borderRadius:'6px', whiteSpace:'nowrap' },
  checkboxLabel: { display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.85rem', whiteSpace:'nowrap', cursor:'pointer' },
  removeBtn: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'0.4rem 0.6rem', cursor:'pointer', color:'var(--red)', fontSize:'0.8rem' },
  addBtn: { marginTop:'0.6rem', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'0.9rem', fontWeight:600, padding:0 }
}
