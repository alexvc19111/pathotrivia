export default function Poll({ question, onAnswer, disabled, answered, myAnswer }) {
  const COLORS = ['#e53e3e','#3182ce','#38a169','#d69e2e','#f97316','#ec4899']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
      {(question?.options || []).map((opt, i) => (
        <button key={opt.id} onClick={() => !answered && onAnswer(opt.id)} disabled={answered}
          style={{ background: answered && myAnswer===opt.id ? COLORS[i%6] : answered ? 'var(--surface)' : COLORS[i%6], border:'none', borderRadius:'12px', padding:'1.5rem 1rem', cursor: answered?'default':'pointer', opacity: answered && myAnswer!==opt.id ? 0.4 : 1, transition:'all 0.2s', fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'0.95rem', color:'white', textAlign:'center', wordWrap:'break-word' }}>
          {opt.option_text ?? opt.optionText}
        </button>
      ))}
    </div>
  )
}