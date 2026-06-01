import { useState, useEffect } from 'react'

export default function Puzzle({ question, onAnswer, disabled, answered }) {
  // Inicializar con array vacío y sincronizar cuando lleguen las opciones
  const [order, setOrder] = useState([])
  const [dragging, setDragging] = useState(null)

  useEffect(() => {
    if (question?.options?.length) {
      // Mezclar el orden para que no aparezca ya ordenado
      const shuffled = [...question.options].sort(() => Math.random() - 0.5)
      setOrder(shuffled)
    }
  }, [question?.id]) // Solo re-mezclar si cambia la pregunta

  const handleDragStart = (idx) => setDragging(idx)
  const handleDragOver  = (e)   => e.preventDefault()

  const handleDrop = (idx) => {
    if (dragging === null || dragging === idx) return
    const next = [...order]
    const [item] = next.splice(dragging, 1)
    next.splice(idx, 0, item)
    setOrder(next)
    setDragging(null)
  }

  const handleSubmit = () => {
    if (!answered && order.length > 0) {
      onAnswer(order.map(o => o.id))
    }
  }

  if (!order.length) {
    return <p style={{ color: 'var(--text3)', textAlign: 'center', padding: '1rem' }}>Cargando opciones...</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center' }}>
        Arrastra los elementos para ordenarlos correctamente
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {order.map((opt, i) => (
          <div
            key={opt.id}
            draggable={!answered && !disabled}
            onDragStart={() => handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
            style={{
              background: dragging === i ? 'rgba(124,58,237,0.2)' : 'var(--surface2)',
              border: `1px solid ${dragging === i ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              cursor: answered ? 'default' : 'grab',
              opacity: answered ? 0.7 : 1,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              userSelect: 'none'
            }}
          >
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--accent2)', minWidth: '24px' }}>
              {i + 1}.
            </span>
            <span style={{ color: 'var(--text)' }}>
              {opt.option_text ?? opt.optionText}
            </span>
            {!answered && !disabled && (
              <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: '1.1rem' }}>⠿</span>
            )}
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={answered || disabled} className="btn-primary">
        Confirmar orden
      </button>
    </div>
  )
}