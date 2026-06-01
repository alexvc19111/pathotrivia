import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_LABELS = {
  multiple_choice: 'Opción múltiple',
  true_false:      'Verdadero / Falso',
  type_answer:     'Escribir respuesta',
  puzzle:          'Puzzle',
  poll:            'Encuesta',
  word_cloud:      'Nube de palabras',
  slider:          'Deslizador',
  brainstorm:      'Brainstorm',
  drop_pin:        'Señalar imagen',
  matching:        'Emparejar'
}

export default function PDFImporter({ quizId, authHeaders, onDone = () => {}, onCancel = () => {} }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState([])   // preguntas parseadas por el servidor
  const [dragOver, setDragOver] = useState(false)
  const [step, setStep]       = useState('select') // select | preview | importing

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Por favor selecciona un archivo PDF')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede superar los 10 MB')
      return
    }
    setFile(selectedFile)
    await parsePdf(selectedFile)
  }

  const parsePdf = async (pdfFile) => {
    setLoading(true)
    setStep('select')
    try {
      const formData = new FormData()
      formData.append('pdf', pdfFile)

      // Endpoint de parseo: devuelve las preguntas detectadas sin guardarlas aún
      const res = await fetch(`/api/quizzes/${quizId}/parse-pdf`, {
        method: 'POST',
        headers: { Authorization: authHeaders().Authorization },  // sin Content-Type, lo pone el browser
        body: formData
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error procesando el PDF')

      if (!data.questions?.length) {
        toast.error('No se detectaron preguntas en el PDF. Revisa el formato.')
        setFile(null)
        return
      }

      setPreview(data.questions)
      setStep('preview')
      toast.success(`${data.questions.length} pregunta${data.questions.length !== 1 ? 's' : ''} detectada${data.questions.length !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err.message)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!preview.length) return
    setLoading(true)
    setStep('importing')
    try {
      const res = await fetch(`/api/quizzes/${quizId}/import-pdf`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ questions: preview })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error importando preguntas')
      toast.success(`✓ ${data.imported} pregunta${data.imported !== 1 ? 's' : ''} importada${data.imported !== 1 ? 's' : ''} correctamente`)
      onDone()
    } catch (err) {
      toast.error(err.message)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const removeQuestion = (idx) => setPreview(prev => prev.filter((_, i) => i !== idx))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', zIndex:50 }}>
      <div className="card animate-popIn" style={{ width:'100%', maxWidth:'560px', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'1.25rem' }}>📄 Importar desde PDF</h2>
          <button onClick={onCancel} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Formatos soportados */}
        {step === 'select' && (
          <div style={{ background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:'12px', padding:'1rem', marginBottom:'1rem', fontSize:'0.82rem', color:'var(--text2)', lineHeight:1.7 }}>
            <p style={{ fontWeight:600, marginBottom:'0.4rem', color:'var(--text)' }}>Formatos detectados automáticamente:</p>
            <p>• <strong>A) B) C) D)</strong> con "Respuesta: A" al final</p>
            <p>• Opciones con <strong>*</strong> marcando la correcta</p>
            <p>• Preguntas de <strong>Verdadero/Falso</strong> → terminar con (Verdadero) o (Falso)</p>
            <p>• Respuesta abierta → "Respuesta: texto"</p>
          </div>
        )}

        {/* Drop zone */}
        {step === 'select' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            style={{ border:`2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius:'14px', padding:'2.5rem 2rem', textAlign:'center', transition:'all 0.2s', background: dragOver ? 'rgba(124,58,237,0.06)' : 'transparent' }}
          >
            <label style={{ cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
              <input type="file" accept=".pdf,application/pdf" onChange={e => handleFile(e.target.files?.[0])} style={{ display:'none' }} disabled={loading} />
              <div style={{ fontSize:'2.5rem' }}>{loading ? '⏳' : file ? '📄' : '📁'}</div>
              <p style={{ color:'var(--text2)', fontSize:'0.95rem', fontWeight:500 }}>
                {loading ? 'Procesando PDF...' : file ? file.name : 'Selecciona un PDF o arrastra aquí'}
              </p>
              <p style={{ color:'var(--text3)', fontSize:'0.82rem' }}>
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Máximo 10 MB · Solo archivos .pdf'}
              </p>
            </label>
          </div>
        )}

        {/* Preview de preguntas */}
        {step === 'preview' && preview.length > 0 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <p style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--text2)' }}>
                ✓ {preview.length} pregunta{preview.length !== 1 ? 's' : ''} detectada{preview.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => { setFile(null); setPreview([]); setStep('select') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:'0.82rem' }}>
                Cambiar PDF
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:'340px', overflowY:'auto', padding:'0.25rem' }}>
              {preview.map((q, idx) => (
                <div key={idx} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', padding:'0.75rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                  <span style={{ color:'var(--text3)', fontSize:'0.8rem', fontWeight:600, minWidth:'24px', paddingTop:'1px' }}>
                    {idx + 1}.
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.88rem', color:'var(--text)', marginBottom:'0.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {q.questionText}
                    </p>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                      <span style={{ fontSize:'0.72rem', background:'var(--bg3)', color:'var(--text2)', padding:'0.1rem 0.5rem', borderRadius:'20px' }}>
                        {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      {q.options?.length > 0 && (
                        <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>
                          {q.options.length} opciones
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeQuestion(idx)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:'0.9rem', padding:'0.1rem', flexShrink:0 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <p style={{ fontSize:'0.78rem', color:'var(--text3)', marginTop:'0.75rem' }}>
              ⓘ Puedes eliminar preguntas antes de importar. Las opciones y respuestas correctas se guardan automáticamente.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.5rem' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex:1 }}>Cancelar</button>
          {step === 'select' && (
            <button disabled className="btn-primary" style={{ flex:1, opacity:0.4 }}>
              Selecciona un PDF primero
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleImport} disabled={loading || preview.length === 0} className="btn-primary" style={{ flex:1 }}>
              {loading ? '⏳ Importando...' : `✓ Importar ${preview.length} pregunta${preview.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}