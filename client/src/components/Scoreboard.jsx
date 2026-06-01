export default function Scoreboard({ players = [] }) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10)

  return (
    <div className="glass animate-fadeIn" style={{ borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '600px' }}>
      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        CLASIFICACIÓN EN VIVO
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sorted.map((player, i) => (
          <div
            key={player.id}
            className="animate-slideIn"
            style={{
              animationDelay: `${i * 0.04}s`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: i === 0 ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
              borderRadius: '10px',
              border: i === 0 ? '1px solid rgba(251, 191, 36, 0.3)' : 'none'
            }}
          >
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: ['#fbbf24', '#d1d5db', '#cd7c2f'][i] ?? 'var(--text3)', width: '28px', textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </span>
            <span style={{ fontSize: '1.25rem' }}>{player.avatar ?? '🎮'}</span>
            <span style={{ flex: 1, color: 'var(--text)', fontWeight: 500 }}>{player.nickname}</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--accent2)', fontSize: '1rem' }}>
              {(player.score || 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
