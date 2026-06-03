function SortableItem({ item, index, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: item.id
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    
    transition: isDragging ? 'none' : transition,

    background: isDragging
      ? 'rgba(124,58,237,0.3)' 
      : 'var(--surface2)',

    border: `1px solid ${
      isDragging
        ? 'var(--accent)'
        : 'var(--border)'
    }`,

    borderRadius: '12px',
    padding: '1rem 1.25rem',

    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',

    userSelect: 'none',
    touchAction: 'none',

    cursor: disabled ? 'default' : 'grab',

    willChange: 'transform',
    zIndex: isDragging ? 999 : 1,

    boxShadow: isDragging
      ? '0 12px 30px rgba(0,0,0,.35)'
      : 'none'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          color: 'var(--accent2)',
          minWidth: '24px'
        }}
      >
        {index + 1}.
      </span>

      <span style={{ color: 'var(--text)' }}>
        {item.option_text ?? item.optionText}
      </span>

      {!disabled && (
        <span
          style={{
            marginLeft: 'auto',
            color: 'var(--text3)',
            fontSize: '1.1rem'
          }}
        >
          ⠿
        </span>
      )}
    </div>
  )
}
