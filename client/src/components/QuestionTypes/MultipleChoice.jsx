export default function MultipleChoice({ question, onAnswer, disabled, answered, myAnswer }) {
  const COLORS = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e']
  const ICONS  = ['▲', '◆', '●', '★']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {(question?.options || []).map((opt, i) => (
        <button
          key={opt.id}
          onClick={() => !answered && onAnswer(opt.id)}
          disabled={answered}
          style={{
            background: answered && myAnswer === opt.id ? COLORS[i%4] : answered ? 'var(--surface)' : COLORS[i%4],
            border: 'none', borderRadius: '16px', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
            cursor: answered ? 'default' : 'pointer',
            opacity: answered && myAnswer !== opt.id ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '1.5rem', color: 'white', width: '32px', textAlign: 'center' }}>{ICONS[i%4]}</span>
          <span style={{ color: 'white', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.05rem', textAlign: 'left' }}>
            {opt.option_text ?? opt.optionText}
          </span>
        </button>
      ))}
    </div>
  )
}