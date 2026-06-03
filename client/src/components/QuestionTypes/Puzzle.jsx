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
    WebkitUserSelect: 'none',   // 
    KhtmlUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none', 
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
          minWidth: '24px',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        {index + 1}.
      </span>

      <span style={{ color: 'var(--text)', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
        {item.option_text ?? item.optionText}
      </span>

      {!disabled && (
        <span
          style={{
            marginLeft: 'auto',
            color: 'var(--text3)',
            fontSize: '1.1rem',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          ⠿
        </span>
      )}
    </div>
  )
}


export default function Puzzle({
  question,
  onAnswer,
  disabled,
  answered
}) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (question?.options?.length) {
      const shuffled = [...question.options].sort(
        () => Math.random() - 0.5
      )
      setItems(shuffled)
    }
  }, [question?.id])


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,    
        tolerance: 5   
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
