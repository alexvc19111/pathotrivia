import { useState, useEffect } from 'react'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'

import { CSS } from '@dnd-kit/utilities'

// ==========================================
// COMPONENTE: SortableItem (Elementos de la lista)
// ==========================================
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
    // 1. Usamos Translate en lugar de Transform para evitar saltos y redimensionamientos raros
    transform: CSS.Translate.toString(transform),
    
    // 2. Desactivamos la transición CSS nativa MIENTRAS se arrastra para eliminar el lag
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

    // 3. Forzamos aceleración por hardware y controlamos que la tarjeta arrastrada flote encima de todo
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
      {/* pointerEvents: 'none' evita que el navegador pierda el foco de arrastre al pasar sobre el texto */}
      <span
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          color: 'var(--accent2)',
          minWidth: '24px',
          pointerEvents: 'none'
        }}
      >
        {index + 1}.
      </span>

      <span style={{ color: 'var(--text)', pointerEvents: 'none' }}>
        {item.option_text ?? item.optionText}
      </span>

      {!disabled && (
        <span
          style={{
            marginLeft: 'auto',
            color: 'var(--text3)',
            fontSize: '1.1rem',
            pointerEvents: 'none'
          }}
        >
          ⠿
        </span>
      )}
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL: Puzzle
// ==========================================
export default function Puzzle({
  question,
  onAnswer,
  disabled,
  answered
}) {
  const [items, setItems] = useState([])

  // Mezclar las opciones aleatoriamente al cargar una nueva pregunta
  useEffect(() => {
    if (question?.options?.length) {
      const shuffled = [...question.options].sort(
        () => Math.random() - 0.5
      )
      setItems(shuffled)
    }
  }, [question?.id])

  // 4. OPTIMIZACIÓN CRÍTICA: Usamos únicamente PointerSensor (unifica mouse y touch) 
  // con restricciones para convivir en paz con el scroll del celular.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,    // El usuario debe presionar 120ms antes de arrastrar (evita falsos arrastres al hacer scroll)
        tolerance: 5   // Permite un margen de movimiento de 5px antes de activarse
      }
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setItems((current) => {
      const oldIndex = current.findIndex(
        item => item.id === active.id
      )

      const newIndex = current.findIndex(
        item => item.id === over.id
      )

      return arrayMove(
        current,
        oldIndex,
        newIndex
      )
    })
  }

  const handleSubmit = () => {
    if (answered || disabled) return

    onAnswer(
      items.map(item => item.id)
    )
  }

  if (!items.length) {
    return (
      <p
        style={{
          color: 'var(--text3)',
          textAlign: 'center',
          padding: '1rem'
        }}
      >
        Cargando opciones...
      </p>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}
    >
      <p
        style={{
          color: 'var(--text3)',
          fontSize: '0.85rem',
          textAlign: 'center'
        }}
      >
        Mantén presionado y arrastra para ordenar
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(i => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                disabled={answered || disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={handleSubmit}
        disabled={answered || disabled}
        className="btn-primary"
        style={{ marginTop: '0.5rem' }}
      >
        Confirmar orden
      </button>
    </div>
  )
}
