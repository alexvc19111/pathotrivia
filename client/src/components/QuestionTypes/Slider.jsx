import { useState } from 'react'

export default function Slider({ question, onAnswer, disabled, answered }) {
  const [value, setValue] = useState(question?.sliderMin ?? question?.slider_min ?? 0)
  const min = question?.sliderMin ?? question?.slider_min ?? 0
  const max = question?.sliderMax ?? question?.slider_max ?? 100

  const handleSubmit = () => { if (!answered) onAnswer(value) }

  return (
    <div style={{ padding:'1rem', background:'var(--surface)', borderRadius:'16px', border:'1px solid var(--border)' }}>
      <p style={{ textAlign:'center', fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:'2rem', marginBottom:'1rem', color:'var(--accent2)' }}>
        {value}
      </p>
      <input type="range" min={min} max={max} value={value} onChange={e=>setValue(Number(e.target.value))}
        disabled={disabled||answered}
        style={{ width:'100%', accentColor:'var(--accent)', marginBottom:'1rem', cursor:answered?'default':'pointer' }} />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text3)', marginBottom:'1rem' }}>
        <span>{min}</span><span>{max}</span>
      </div>
      <button onClick={handleSubmit} disabled={answered||disabled} className="btn-primary" style={{ width:'100%' }}>
        Confirmar
      </button>
    </div>
  )
}