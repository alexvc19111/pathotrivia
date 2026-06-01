import { useState } from 'react'

export default function WordCloud({ question, onAnswer, disabled, answered }) {
  const [word, setWord]   = useState('')
  const [words, setWords] = useState([])

  const addWord    = () => { if (word.trim()) { setWords(w=>[...w, word.trim()]); setWord('') } }
  const removeWord = (i) => setWords(w => w.filter((_,j)=>j!==i))
  const handleSubmit = () => { if (!answered && words.length > 0) onAnswer(words) }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      <div style={{ display:'flex', gap:'0.75rem' }}>
        <input type="text" value={word} onChange={e=>setWord(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addWord()}
          disabled={answered||disabled} placeholder="Escribe una palabra..." className="input-field" style={{ flex:1 }} />
        <button onClick={addWord} disabled={answered||disabled||!word.trim()} className="btn-primary">+</button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', minHeight:'40px' }}>
        {words.map((w,i) => (
          <div key={i} style={{ background:'var(--accent)', color:'white', padding:'0.5rem 0.75rem', borderRadius:'20px', fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {w}
            {!answered && <button onClick={()=>removeWord(i)} style={{ background:'none', border:'none', color:'white', cursor:'pointer', lineHeight:1 }}>✕</button>}
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={answered||disabled||words.length===0} className="btn-primary">
        Enviar palabras ({words.length})
      </button>
    </div>
  )
}