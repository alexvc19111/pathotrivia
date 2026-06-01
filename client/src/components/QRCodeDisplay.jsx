import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeDisplay({ url, size = 180, showLabel = true }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {showLabel && <p style={{ fontSize: '0.8rem', color: 'var(--text3)', fontFamily: 'Syne, sans-serif' }}>ESCANEA PARA UNIRTE</p>}
      <div style={{ background: 'white', padding: '1.25rem', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <QRCodeSVG value={url} size={size} bgColor="#ffffff" fgColor="#0a0a0f" level="H" />
      </div>
    </div>
  )
}
