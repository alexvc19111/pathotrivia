export default function TrueFalse({ question, onAnswer, disabled, answered, myAnswer }) {
  // Usar las opciones reales de la BD para obtener los UUIDs correctos
  const options = question?.options?.length
    ? question.options.map(opt => ({
        id:    opt.id,
        text:  opt.option_text ?? opt.optionText,
        color: (opt.option_text ?? opt.optionText)?.toLowerCase() === 'verdadero' ? '#10b981' : '#ef4444'
      }))
    : [
        { id: 'true',  text: 'Verdadero', color: '#10b981' },
        { id: 'false', text: 'Falso',     color: '#ef4444' }
      ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => !answered && onAnswer(opt.id)}
          disabled={answered}
          style={{
            background: answered && myAnswer === opt.id ? opt.color : answered ? 'var(--surface)' : opt.color,
            border: 'none',
            borderRadius: '16px',
            padding: '2rem 1rem',
            cursor: answered ? 'default' : 'pointer',
            opacity: answered && myAnswer !== opt.id ? 0.5 : 1,
            transition: 'all 0.2s',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '1.25rem',
            color: 'white'
          }}
        >
          {opt.text}
        </button>
      ))}
    </div>
  )
}