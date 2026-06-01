import { useState } from 'react'

export default function Matching({ question, onAnswer, disabled, answered }) {
  // Soportar tanto snake_case (match_group) como camelCase (matchGroup) del servidor
  const getGroup = (o) => o.match_group ?? o.matchGroup

  // Mezclar cada columna de forma determinista por pregunta (mismo orden para todos los jugadores)
  const shuffle = (arr, seed) => {
    const a = [...arr]
    let s = seed
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      const j = Math.abs(s) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  // Usar el id de la pregunta como semilla para que todos vean el mismo orden mezclado
  const seed = question?.id?.charCodeAt(0) ?? 42
  const columnA = shuffle(question?.options?.filter(o => getGroup(o) === 'A') || [], seed)
  const columnB = shuffle(question?.options?.filter(o => getGroup(o) === 'B') || [], seed + 1)
  const [matches, setMatches] = useState({})
  const [selected, setSelected] = useState(null) // id del elemento A seleccionado

  // Soporte táctil (móvil): tap A → tap B para emparejar
  const handleSelectA = (id) => {
    if (answered || disabled) return
    setSelected(prev => prev === id ? null : id)
  }

  const handleSelectB = (id) => {
    if (answered || disabled || !selected) return
    setMatches(prev => ({ ...prev, [selected]: id }))
    setSelected(null)
  }

  // Drag & drop para desktop
  const [dragging, setDragging] = useState(null)
  const handleDragStart = (id) => setDragging(id)
  const handleDrop = (targetId) => {
    if (dragging && dragging !== targetId) {
      setMatches(prev => ({ ...prev, [dragging]: targetId }))
      setDragging(null)
    }
  }

  const handleSubmit = () => {
    if (!answered && Object.keys(matches).length === columnA.length) onAnswer(matches)
  }

  const clearMatch = (aId) => { if (!answered) setMatches(prev => { const n={...prev}; delete n[aId]; return n }) }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {selected && <p style={{ textAlign:'center', fontSize:'0.85rem', color:'var(--accent2)', fontWeight:600 }}>Ahora selecciona el par en la columna derecha</p>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <p style={{ fontSize:'0.78rem', color:'var(--text3)', fontWeight:600, textAlign:'center', marginBottom:'0.25rem' }}>COLUMNA A</p>
          {columnA.map(opt => (
            <div key={opt.id} draggable={!answered&&!disabled} onDragStart={()=>handleDragStart(opt.id)}
              onClick={()=>handleSelectA(opt.id)}
              style={{ background: selected===opt.id ? 'var(--accent)' : matches[opt.id] ? 'rgba(124,58,237,0.2)' : 'var(--surface2)', border:`1px solid ${selected===opt.id?'var(--accent)':matches[opt.id]?'var(--accent)':'var(--border)'}`, borderRadius:'10px', padding:'0.75rem', cursor:answered?'default':'pointer', transition:'all 0.15s', fontSize:'0.9rem', color:'var(--text)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>{opt.option_text ?? opt.optionText}</span>
              {matches[opt.id] && !answered && <button onClick={e=>{e.stopPropagation();clearMatch(opt.id)}} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'0.8rem' }}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <p style={{ fontSize:'0.78rem', color:'var(--text3)', fontWeight:600, textAlign:'center', marginBottom:'0.25rem' }}>COLUMNA B</p>
          {columnB.map(opt => (
            <div key={opt.id} onDragOver={e=>e.preventDefault()} onDrop={()=>handleDrop(opt.id)}
              onClick={()=>handleSelectB(opt.id)}
              style={{ background: Object.values(matches).includes(opt.id) ? 'rgba(16,185,129,0.15)' : selected ? 'rgba(124,58,237,0.05)' : 'var(--surface2)', border:`2px dashed ${Object.values(matches).includes(opt.id)?'var(--green)':selected?'var(--accent)':'var(--border)'}`, borderRadius:'10px', padding:'0.75rem', minHeight:'42px', cursor:answered?'default':'pointer', transition:'all 0.15s', fontSize:'0.9rem', color:'var(--text)', display:'flex', alignItems:'center' }}>
              {opt.option_text ?? opt.optionText}
            </div>
          ))}
        </div>
      </div>
      <p style={{ textAlign:'center', fontSize:'0.8rem', color:'var(--text3)' }}>
        {Object.keys(matches).length}/{columnA.length} pares conectados
      </p>
      <button onClick={handleSubmit} disabled={answered||disabled||Object.keys(matches).length!==columnA.length} className="btn-primary">
        Confirmar parejas
      </button>
    </div>
  )
}