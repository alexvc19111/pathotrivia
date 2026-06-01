import { useEffect, useRef, useState } from 'react'

export default function Timer({ seconds, size = 'md', onTimeUp = () => {} }) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const timerRef = useRef(null)

  useEffect(() => {
    setTimeLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp()
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          onTimeUp()
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [timeLeft, onTimeUp])

  const radius = size === 'lg' ? 54 : size === 'md' ? 40 : 25
  const circ = 2 * Math.PI * radius
  const progress = circ - (timeLeft / seconds) * circ

  const color = timeLeft <= 5 ? 'var(--red)' : timeLeft <= 10 ? 'var(--yellow)' : 'var(--accent2)'

  if (size === 'sm') {
    return (
      <div style={{ fontSize: '1.25rem', fontFamily: 'Syne, sans-serif', fontWeight: 800, color }}>
        {timeLeft}s
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: `${radius * 2 + 16}px`, height: `${radius * 2 + 16}px` }}>
      <svg width={radius * 2 + 16} height={radius * 2 + 16} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={radius + 8} cy={radius + 8} r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx={radius + 8}
          cy={radius + 8}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: `${size === 'lg' ? 2.5 : 1.5}rem`, color }}>
        {timeLeft}
      </div>
    </div>
  )
}
