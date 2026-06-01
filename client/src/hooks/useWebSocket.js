import { useEffect, useRef, useCallback } from 'react'

export function buildWsUrl(path = '') {
  return `${import.meta.env.VITE_WS_URL}${path}`
}

export function useWebSocket({ url, onMessage, enabled = true }) {
  const wsRef        = useRef(null)
  const reconnectRef = useRef(null)
  const onMessageRef = useRef(onMessage)
 
  // Mantener referencia actualizada del callback sin reiniciar el efecto
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
 
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('[WS] send called but socket not open, state:', wsRef.current?.readyState)
    }
  }, [])
 
  useEffect(() => {
    if (!enabled || !url) return
 
    let destroyed = false
 
    const connect = () => {
      if (destroyed) return
 
      console.log('[WS] connecting to', url)
      const ws = new WebSocket(url)
      wsRef.current = ws
 
      ws.onopen = () => {
        if (destroyed) { ws.close(); return }
        console.log('[WS] connected ✓')
        clearTimeout(reconnectRef.current)
      }
 
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          onMessageRef.current?.(data)
        } catch (err) {
          console.warn('[WS] could not parse message', err)
        }
      }
 
      ws.onclose = (e) => {
        if (destroyed) return
        console.log(`[WS] closed (code ${e.code}) — reconnecting in 2s`)
        reconnectRef.current = setTimeout(connect, 2000)
      }
 
      ws.onerror = () => {
        // El error real llega en onclose; aquí solo logueamos
        console.warn('[WS] connection error')
      }
    }
 
    connect()
 
    return () => {
      destroyed = true
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [url, enabled])
 
  return { send }
}
 
