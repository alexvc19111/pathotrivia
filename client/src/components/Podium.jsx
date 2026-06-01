import React from 'react'

export default function Podium({ players = [] }) {
  // 1. Ordenamos de mayor a menor puntaje y tomamos el top 3 real
  const top3 = [...players].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3)

  // 2. Diccionario con estilos estables indexados por posición real:
  // Índice 0 (1er lugar), Índice 1 (2do lugar), Índice 2 (3er lugar)
  const podiumStyles = {
    0: { height: '260px', medal: '🥇', bgColor: 'rgba(251,191,36,0.2)', flexOrder: 2 }, // Primero -> Va al centro
    1: { height: '200px', medal: '🥈', bgColor: 'rgba(209,213,219,0.15)', flexOrder: 1 }, // Segundo -> Va a la izquierda
    2: { height: '170px', medal: '🥉', bgColor: 'rgba(205,124,47,0.15)', flexOrder: 3 }  // Tercero -> Va a la derecha
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a0f 0%,#1a0a2e 50%,#0a0a1a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      {/* Efecto de luz de fondo */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 60%, rgba(124,58,237,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <h1 className="animate-bounceIn" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '3rem', textAlign: 'center', marginBottom: '3rem', background: 'linear-gradient(135deg,#fbbf24,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        🏆 ¡Ganadores!
      </h1>

      {/* Contenedor de las columnas */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '3rem', justifyContent: 'center', width: '100%', maxWidth: '600px' }}>
        
        {/* 3. Mapeamos dinámicamente solo sobre los jugadores existentes en el Top 3 */}
        {top3.map((player, index) => {
          const config = podiumStyles[index]

          return (
            <div 
              key={player.id || index} 
              className="animate-popIn" 
              style={{ 
                animationDelay: `${index * 0.2}s`, 
                textAlign: 'center', 
                width: '160px',
                order: config.flexOrder // 💡 Reordena los elementos en el contenedor Flexbox visualmente sin romper los índices
              }}
            >
              {/* Avatar */}
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                {player.avatar ?? '🎮'}
              </div>
              
              {/* Nickname */}
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {player.nickname}
              </p>
              
              {/* Puntaje */}
              <p style={{ color: 'var(--accent2)', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                {(player.score || 0).toLocaleString()}
              </p>
              
              {/* Columna física del podio con su medalla */}
              <div
                style={{
                  height: config.height,
                  background: config.bgColor,
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '1rem',
                  fontSize: '2rem'
                }}
              >
                {config.medal}
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}