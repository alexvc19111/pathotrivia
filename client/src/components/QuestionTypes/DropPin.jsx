import { useState } from 'react'

export default function DropPin({ question, onAnswer, disabled, answered }) {
  const [pin, setPin] = useState(null)
  const imageUrl = question?.mediaUrl ?? question?.media_url

  const handleImageClick = (e) => {
    if (answered || disabled || !imageUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width * 100)
    const y = ((e.clientY - rect.top)  / rect.height * 100)
    setPin({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) })
  }

  const handleConfirm = () => { if (pin && !answered) onAnswer(pin) }

  if (!imageUrl) return (
    <p style={{ textAlign:'center', color:'var(--text3)', padding:'2rem' }}>
      Esta pregunta necesita una imagen configurada.
    </p>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      {/* Imagen clickeable — ocupa todo el ancho disponible */}
      <div style={{ position:'relative', width:'100%', touchAction:'none' }}>
        <img
          src={imageUrl}
          alt="Señala el punto"
          onClick={handleImageClick}
          onTouchEnd={e => {
            if (answered || disabled) return
            e.preventDefault()
            const touch = e.changedTouches[0]
            const rect  = e.currentTarget.getBoundingClientRect()
            const x = ((touch.clientX - rect.left) / rect.width * 100)
            const y = ((touch.clientY - rect.top)  / rect.height * 100)
            setPin({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) })
          }}
          draggable={false}
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '200px',
            maxHeight: '55vh',
            objectFit: 'contain',
            borderRadius: '14px',
            border: `2px solid ${pin ? 'var(--accent)' : 'var(--border)'}`,
            cursor: answered ? 'default' : 'crosshair',
            display: 'block',
            userSelect: 'none'
          }}
        />

        {pin && (
          <>
            {/* Cruz de mira */}
            <div style={{ position:'absolute', left:`${pin.x}%`, top:`${pin.y}%`, transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
              <div style={{ position:'absolute', width:'32px', height:'2px', background:'rgba(255,255,255,0.7)', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
              <div style={{ position:'absolute', width:'2px', height:'32px', background:'rgba(255,255,255,0.7)', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
            </div>

            {/* Pin central */}
            <div
              onClick={() => !answered && setPin(null)}
              style={{ position:'absolute', left:`${pin.x}%`, top:`${pin.y}%`, transform:'translate(-50%,-50%)', width:'22px', height:'22px', background:'var(--accent2)', border:'3px solid white', borderRadius:'50%', boxShadow:'0 2px 10px rgba(0,0,0,0.5)', cursor: answered ? 'default' : 'pointer', zIndex:2 }}
              title="Clic para quitar"
            />
          </>
        )}

        {/* Hint flotante */}
        {!answered && (
          <div style={{ position:'absolute', bottom:'8px', left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.65)', color:'white', fontSize:'0.78rem', padding:'0.3rem 0.75rem', borderRadius:'20px', whiteSpace:'nowrap', pointerEvents:'none' }}>
            {pin ? '📍 Toca el pin para quitarlo' : 'Toca la imagen para marcar'}
          </div>
        )}
      </div>

      {pin && (
        <p style={{ fontSize:'0.82rem', color:'var(--text3)', textAlign:'center' }}>
          Marcado en ({pin.x.toFixed(1)}%, {pin.y.toFixed(1)}%)
        </p>
      )}

      <button
        onClick={handleConfirm}
        disabled={answered || disabled || !pin}
        className="btn-primary"
        style={{ padding:'1rem' }}
      >
        {pin ? '✓ Confirmar ubicación' : 'Toca la imagen para marcar un punto'}
      </button>
    </div>
  )
}