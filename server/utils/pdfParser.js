const pdfParse = require('pdf-parse')

// ─────────────────────────────────────────────────────────────────────────────
// FORMATOS SOPORTADOS EN EL PDF
// ─────────────────────────────────────────────────────────────────────────────
//
// FORMATO 1 — Numerado con opciones A/B/C/D
// ─────────────────────────────────────────────
// 1. ¿Cuál es la capital de Francia?
// A) París
// B) Londres
// C) Roma
// D) Berlín
// Respuesta: A
//
// FORMATO 2 — Numerado con asterisco en correcta
// ─────────────────────────────────────────────
// 1. ¿Cuál es la capital de Francia?
// * París
//   Londres
//   Roma
//   Berlín
//
// FORMATO 3 — Verdadero/Falso
// ─────────────────────────────────────────────
// 1. El sol gira alrededor de la Tierra. (Falso)
// 2. El agua hierve a 100°C. (Verdadero)
//
// FORMATO 4 — Pregunta abierta (type_answer)
// ─────────────────────────────────────────────
// 1. ¿Cuánto es 2 + 2?
// Respuesta: 4
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae texto del buffer PDF y lo convierte en preguntas.
 * @param {Buffer} buffer - Buffer del archivo PDF
 * @returns {Promise<Array>} Array de objetos pregunta listos para insertar en BD
 */
async function parsePdfBuffer(buffer) {
  // 1. Extraer texto crudo del PDF
  const data = await pdfParse(buffer)
  const rawText = data.text

  // 2. Dividir en bloques por número de pregunta (1. / 1) / Pregunta 1:)
  const blocks = splitIntoBlocks(rawText)

  // 3. Parsear cada bloque
  const questions = []
  for (const block of blocks) {
    const parsed = parseBlock(block)
    if (parsed) questions.push(parsed)
  }

  return questions
}

// ─── Divide el texto en bloques de pregunta ──────────────────────────────────
function splitIntoBlocks(text) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  const lines = normalized.split('\n')
  const blocks = []
  let current = []

  const isQuestionStart = (line) =>
    /^(?:Pregunta\s+)?\d+[.):]\s+\S/.test(line.trim())

  // Líneas que son encabezados de sección, títulos o notas — ignorar
  const isSectionHeader = (line) =>
    /^(Formato\s+\d+|Nota|Instrucciones|Sección|Seccion|Titulo|Title)/i.test(line.trim())

  for (const line of lines) {
    if (isSectionHeader(line)) continue  // saltar encabezados de sección

    if (isQuestionStart(line)) {
      if (current.length) blocks.push(current.join('\n'))
      current = [line]
    } else {
      if (current.length) current.push(line)
      // Ignorar líneas antes de la primera pregunta (título del PDF, etc.)
    }
  }
  if (current.length) blocks.push(current.join('\n'))

  return blocks.filter(b => b.trim().length > 0)
}

// ─── Parsea un bloque individual y devuelve un objeto pregunta ───────────────
function parseBlock(block) {
  const lines = block
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length === 0) return null

  const questionText = lines[0].replace(/^\d+[.)]\s*/, '').trim()
  if (!questionText) return null

  const restLines = lines.slice(1)

  // ── Intentar cada formato ──────────────────────────────────────────────────

  // Formato Verdadero/Falso: la pregunta termina en (Verdadero) o (Falso)
  const tfMatch = questionText.match(/\(?\s*(verdadero|falso|true|false|v|f)\s*\)?$/i)
  if (tfMatch) {
    const isTrue = /^(verdadero|true|v)$/i.test(tfMatch[1])
    return buildTrueFalse(questionText.replace(tfMatch[0], '').trim(), isTrue)
  }

  // Formato A/B/C/D con "Respuesta: X" al final
  const abcdOptions = extractAbcdOptions(restLines)
  if (abcdOptions.options.length >= 2) {
    return buildMultipleChoice(questionText, abcdOptions.options, abcdOptions.correctLetter)
  }

  // Formato con asterisco (*) en la opción correcta
  const starOptions = extractStarOptions(restLines)
  if (starOptions.length >= 2) {
    return buildMultipleChoiceFromStar(questionText, starOptions)
  }

  // Formato Respuesta: <texto> → type_answer
  const answerLine = restLines.find(l => /^respuesta\s*:/i.test(l))
  if (answerLine) {
    const correctAnswer = answerLine.replace(/^respuesta\s*:\s*/i, '').trim()
    return buildTypeAnswer(questionText, correctAnswer)
  }

  // Opciones sin letra ni asterisco (líneas cortas debajo de la pregunta)
  const plainOptions = extractPlainOptions(restLines)
  if (plainOptions.length >= 2) {
    return buildMultipleChoiceFromStar(questionText, plainOptions.map(o => ({ text: o, correct: false })))
  }

  // Si no encaja en nada → pregunta abierta sin respuesta definida
  return buildTypeAnswer(questionText, '')
}

// ─── Extractores ─────────────────────────────────────────────────────────────

function extractAbcdOptions(lines) {
  // Busca líneas tipo: A) texto  /  a. texto  /  A- texto
  const optionRegex = /^([A-Da-d])[.):\-]\s*(.+)$/
  const options = []
  let correctLetter = null

  for (const line of lines) {
    const match = line.match(optionRegex)
    if (match) {
      options.push({ letter: match[1].toUpperCase(), text: match[2].trim() })
      continue
    }
    // Busca "Respuesta: A" o "Correcta: B"
    const respMatch = line.match(/^(?:respuesta|correcta?)\s*[:\-]\s*([A-Da-d])/i)
    if (respMatch) {
      correctLetter = respMatch[1].toUpperCase()
    }
  }

  return { options, correctLetter }
}

function extractStarOptions(lines) {
  // Busca líneas que empiezan con * (correcta) o sin * (incorrecta)
  // Solo aplica si hay al menos una línea con *
  const hasStars = lines.some(l => l.startsWith('*'))
  if (!hasStars) return []

  return lines
    .filter(l => !l.match(/^(?:respuesta|correcta?)\s*[:\-]/i))
    .map(l => {
      if (l.startsWith('*')) return { text: l.slice(1).trim(), correct: true }
      return { text: l, correct: false }
    })
    .filter(o => o.text.length > 0)
}

function extractPlainOptions(lines) {
  // Líneas cortas (< 80 chars) que no son metadatos
  return lines
    .filter(l => l.length < 80 && !l.match(/^(?:respuesta|correcta?|puntos?|tiempo)\s*[:\-]/i))
}

// ─── Constructores de objetos pregunta ───────────────────────────────────────

function buildMultipleChoice(questionText, options, correctLetter) {
  return {
    type: 'multiple_choice',
    questionText,
    timeLimitSec: 20,
    points: 1000,
    options: options.map(o => ({
      optionText: o.text,
      isCorrect: correctLetter ? o.letter === correctLetter : false,
      position: ['A','B','C','D'].indexOf(o.letter)
    }))
  }
}

function buildMultipleChoiceFromStar(questionText, options) {
  // Si ninguna está marcada como correcta, la primera por defecto
  const hasCorrect = options.some(o => o.correct)
  return {
    type: 'multiple_choice',
    questionText,
    timeLimitSec: 20,
    points: 1000,
    options: options.map((o, i) => ({
      optionText: o.text,
      isCorrect: hasCorrect ? o.correct : i === 0,
      position: i
    }))
  }
}

function buildTrueFalse(questionText, isTrue) {
  return {
    type: 'true_false',
    questionText,
    timeLimitSec: 15,
    points: 500,
    options: [
      { optionText: 'Verdadero', isCorrect: isTrue,  position: 0 },
      { optionText: 'Falso',     isCorrect: !isTrue, position: 1 }
    ]
  }
}

function buildTypeAnswer(questionText, correctAnswer) {
  return {
    type: 'type_answer',
    questionText,
    timeLimitSec: 30,
    points: 1000,
    correctAnswer, // el servidor lo guarda como option o en un campo extra
    options: correctAnswer
      ? [{ optionText: correctAnswer, isCorrect: true, position: 0 }]
      : []
  }
}

// ─── Utilidad: limpiar texto extraído de PDFs escaneados ─────────────────────
function cleanPdfText(text) {
  return text
    .replace(/[""]/g, '"')   // comillas tipográficas
    .replace(/['']/g, "'")   // apóstrofes tipográficos
    .replace(/…/g, '...')
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = { parsePdfBuffer }