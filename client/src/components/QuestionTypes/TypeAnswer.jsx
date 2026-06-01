import { useState } from 'react'

export default function TypeAnswer({ question, onAnswer, disabled, answered }) {
  const [value, setValue] = useState('')
  const handleSubmit = () => { if (value.trim() && !answered) onAnswer(value.trim()) }
  return (
    <div style={{ display:'flex', gap:'0.75rem' }}>
      <input type="text" value={value} onChange={e=>setValue(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
        disabled={answered||disabled} placeholder="Tu respuesta..." className="input-field"
        style={{ fontSize:'1rem', flex:1 }} autoFocus />
      <button onClick={handleSubmit} disabled={answered||disabled||!value.trim()} className="btn-primary"
        style={{ padding:'0.75rem 1.25rem', flexShrink:0 }}>→</button>
    </div>
  )
}