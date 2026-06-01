import { useState } from 'react'

export default function Brainstorm({ question, onAnswer, disabled, answered }) {
  const [text, setText] = useState('')
  const handleSubmit = () => { if (text.trim() && !answered) onAnswer(text.trim()) }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      <textarea value={text} onChange={e=>setText(e.target.value)} disabled={answered||disabled}
        placeholder="Escribe tu idea, pensamiento o respuesta..." className="input-field"
        style={{ minHeight:'120px', fontSize:'0.95rem', fontFamily:'DM Sans, sans-serif', resize:'vertical' }} />
      <button onClick={handleSubmit} disabled={answered||disabled||!text.trim()} className="btn-primary">
        Enviar respuesta
      </button>
    </div>
  )
}