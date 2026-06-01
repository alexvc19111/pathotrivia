const express = require('express')
const pool    = require('../db/pool')
const { requireAuth } = require('../middleware/authMiddleware')
const { v4: uuidv4 }  = require('uuid')

const router = express.Router()

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function createUniquePin() {
  const pin    = generatePin()
  const exists = await pool.query('SELECT id FROM game_sessions WHERE pin = $1', [pin])
  if (exists.rowCount > 0) return createUniquePin()
  return pin
}

// ─── POST / — Crear sesión ───────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { quizId } = req.body
  if (!quizId) return res.status(400).json({ error: 'El quiz es obligatorio' })

  try {
    const pin       = await createUniquePin()
    const sessionId = uuidv4()
    const insert    = await pool.query(
      `INSERT INTO game_sessions (id, quiz_id, pin, status, started_at)
       VALUES ($1, $2, $3, 'waiting', NOW())
       RETURNING id, quiz_id, pin, status, created_at, started_at`,
      [sessionId, quizId, pin]
    )
    const quiz = await pool.query('SELECT title FROM quizzes WHERE id = $1', [quizId])
    res.status(201).json({ ...insert.rows[0], quizTitle: quiz.rows[0]?.title || null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo iniciar la sesión' })
  }
})

// ─── GET /:id — Cargar sesión ────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.pin, s.status, s.created_at, s.started_at, s.finished_at,
              q.title AS quiz_title
       FROM game_sessions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.id = $1`,
      [req.params.id]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'Sesión no encontrada' })
    const s = result.rows[0]
    res.json({
      id:         s.id,
      pin:        s.pin,
      status:     s.status,
      createdAt:  s.created_at,
      startedAt:  s.started_at,
      finishedAt: s.finished_at,
      quizTitle:  s.quiz_title
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error cargando sesión' })
  }
})

// ─── POST /join — Unirse a una sesión ───────────────────────────────────────
router.post('/join', async (req, res) => {
  const { pin, nickname, avatar } = req.body
  if (!pin || !nickname) return res.status(400).json({ error: 'PIN y apodo son obligatorios' })

  try {
    const sessionResult = await pool.query(
      `SELECT s.id, s.status, q.title AS quiz_title
       FROM game_sessions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.pin = $1`,
      [pin]
    )
    if (!sessionResult.rowCount) return res.status(404).json({ error: 'PIN incorrecto' })

    const session = sessionResult.rows[0]
    if (session.status === 'finished') {
      return res.status(400).json({ error: 'La partida ya finalizó' })
    }

    // ── FIX: si el jugador ya existe (recarga de página) devolver el existente ──
    const existing = await pool.query(
      `SELECT id, nickname, avatar FROM players
       WHERE session_id = $1 AND nickname = $2`,
      [session.id, nickname.trim()]
    )

    if (existing.rowCount > 0) {
      // Jugador reconectándose — devolver sus datos sin crear uno nuevo
      return res.json({
        session: { id: session.id, pin, status: session.status, quizTitle: session.quiz_title },
        player:  existing.rows[0],
        reconnected: true
      })
    }

    // Jugador nuevo
    const playerId   = uuidv4()
    const newPlayer  = await pool.query(
      `INSERT INTO players (id, session_id, nickname, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nickname, avatar`,
      [playerId, session.id, nickname.trim(), avatar || null]
    )

    res.json({
      session: { id: session.id, pin, status: session.status, quizTitle: session.quiz_title },
      player:  newPlayer.rows[0],
      reconnected: false
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo unir a la sesión' })
  }
})

// ─── GET /:id/results — Resultados completos ─────────────────────────────────
router.get('/:id/results', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const sessionResult = await pool.query(
      `SELECT s.id, s.pin, s.status, s.created_at, s.finished_at, q.title AS quiz_title
       FROM game_sessions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.id = $1`,
      [id]
    )
    if (!sessionResult.rowCount) return res.status(404).json({ error: 'Sesión no encontrada' })
    const session = sessionResult.rows[0]

    const playersResult = await pool.query(
      `SELECT p.id, p.nickname, p.avatar,
              COALESCE(SUM(pa.points_earned), 0)                                          AS final_score,
              COUNT(pa.*) FILTER (WHERE pa.question_id IS NOT NULL)                       AS answers_count,
              CASE WHEN COUNT(pa.*) = 0 THEN 0
                   ELSE ROUND(100.0 * SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END) / COUNT(pa.*))
              END AS accuracy
       FROM players p
       LEFT JOIN player_answers pa ON pa.player_id = p.id
       WHERE p.session_id = $1
       GROUP BY p.id
       ORDER BY final_score DESC`,
      [id]
    )

    const questionsResult = await pool.query(
      `SELECT q.id, q.question_text, q.type,
              COUNT(pa.*)                                                                   AS total_answers,
              SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)                              AS correct_answers,
              CASE WHEN COUNT(pa.*)=0 THEN 0
                   ELSE ROUND(100.0 * SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END) / COUNT(pa.*))
              END AS accuracy,
              AVG(pa.response_time_ms)                                                     AS avg_time_ms
       FROM questions q
       LEFT JOIN player_answers pa ON pa.question_id = q.id AND pa.session_id = $1
       WHERE q.quiz_id = (SELECT quiz_id FROM game_sessions WHERE id = $1)
       GROUP BY q.id
       ORDER BY q.position ASC, q.created_at ASC`,
      [id]
    )

    // Respuestas individuales por jugador
    const answersResult = await pool.query(
      `SELECT pa.player_id, pa.question_id, pa.is_correct, pa.points_earned,
              pa.response_time_ms, pa.answer_text, pa.answer_numeric,
              q.question_text, q.type AS question_type,
              qo.option_text AS answer_option_text
       FROM player_answers pa
       JOIN questions q ON q.id = pa.question_id
       LEFT JOIN question_options qo ON qo.id = pa.answer_option_id
       WHERE pa.session_id = $1
       ORDER BY pa.answered_at ASC`,
      [id]
    )

    // Pre-cargar opciones de preguntas que lo necesiten (matching, puzzle)
    const questionIds = [...new Set(answersResult.rows.map(a => a.question_id))]
    const optionsMap  = {}
    if (questionIds.length) {
      const optsResult = await pool.query(
        `SELECT id, question_id, option_text, match_group, position
         FROM question_options WHERE question_id = ANY($1)`,
        [questionIds]
      )
      for (const opt of optsResult.rows) {
        if (!optionsMap[opt.question_id]) optionsMap[opt.question_id] = []
        optionsMap[opt.question_id].push(opt)
      }
    }

    const answersByPlayer = answersResult.rows.reduce((acc, a) => {
      if (!acc[a.player_id]) acc[a.player_id] = []

      let answerDisplay = a.answer_option_text || null

      // Matching: traducir JSON de UUIDs a "A → B, C → D"
      if (!answerDisplay && a.question_type === 'matching' && a.answer_text) {
        try {
          const matches  = JSON.parse(a.answer_text)
          const opts     = optionsMap[a.question_id] || []
          const colA     = opts.filter(o => o.match_group === 'A')
          const colB     = opts.filter(o => o.match_group === 'B')
          const optById  = opts.reduce((m, o) => { m[o.id] = o.option_text; return m }, {})
          answerDisplay  = colA
            .map(o => {
              const pairedText = optById[matches[o.id]] ?? '?'
              return `${o.option_text} → ${pairedText}`
            })
            .join(', ')
        } catch { answerDisplay = a.answer_text }
      }

      // Puzzle: traducir JSON de UUIDs al orden de textos
      if (!answerDisplay && a.question_type === 'puzzle' && a.answer_text) {
        try {
          const order   = JSON.parse(a.answer_text)
          const opts    = optionsMap[a.question_id] || []
          const optById = opts.reduce((m, o) => { m[o.id] = o.option_text; return m }, {})
          answerDisplay = order.map((id, i) => `${i+1}. ${optById[id] ?? '?'}`).join(' · ')
        } catch { answerDisplay = a.answer_text }
      }

      // Slider
      if (!answerDisplay && a.answer_numeric != null) answerDisplay = String(a.answer_numeric)

      // Texto libre
      if (!answerDisplay && a.answer_text) {
        if (a.answer_text === 'true')  answerDisplay = 'Verdadero'
        else if (a.answer_text === 'false') answerDisplay = 'Falso'
        else answerDisplay = a.answer_text
      }

      acc[a.player_id].push({
        questionId:     a.question_id,
        questionText:   a.question_text,
        isCorrect:      a.is_correct,
        pointsEarned:   a.points_earned,
        responseTimeMs: a.response_time_ms,
        answerDisplay:  answerDisplay || '—'
      })
      return acc
    }, {})

    const players = playersResult.rows.map((p, i) => ({
      id:          p.id,
      nickname:    p.nickname,
      avatar:      p.avatar,
      finalScore:  Number(p.final_score),
      answersCount: Number(p.answers_count),
      accuracy:    Number(p.accuracy),
      rank:        i + 1,
      answers:     answersByPlayer[p.id] || []
    }))

    const questions = questionsResult.rows.map(q => ({
      id:             q.id,
      questionText:   q.question_text,
      type:           q.type,
      totalAnswers:   Number(q.total_answers),
      correctAnswers: Number(q.correct_answers),
      avgTimeMs:      q.avg_time_ms ? Number(q.avg_time_ms) : null
    }))

    res.json({
      session: {
        id:        session.id,
        pin:       session.pin,
        status:    session.status,
        quizTitle: session.quiz_title,
        createdAt: session.created_at,
        finishedAt: session.finished_at
      },
      players,
      questions
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error cargando resultados' })
  }
})

module.exports = router