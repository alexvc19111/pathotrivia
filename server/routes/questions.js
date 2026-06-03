const express = require('express')
const pool = require('../db/pool')
const { requireAuth } = require('../middleware/authMiddleware')
const { v4: uuidv4 } = require('uuid')

const router = express.Router()
router.use(requireAuth)

// GET: Obtener preguntas de un quiz
router.get('/quizzes/:quizId/questions', async (req, res) => {
  const { quizId } = req.params
  try {
    const questionsResult = await pool.query(
      `SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position ASC, created_at ASC`,
      [quizId]
    )
    const questions = questionsResult.rows
    const questionIds = questions.map(q => q.id)
    if (!questionIds.length) return res.json([])

    const optionsResult = await pool.query(
      `SELECT * FROM question_options WHERE question_id = ANY($1) ORDER BY position ASC`,
      [questionIds]
    )
    const optionsByQuestion = optionsResult.rows.reduce((acc, option) => {
      if (!acc[option.question_id]) acc[option.question_id] = []
      acc[option.question_id].push(option)
      return acc
    }, {})

    res.json(questions.map(q => ({ ...q, question_options: optionsByQuestion[q.id] || [] })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener preguntas' })
  }
})

// POST: Crear una pregunta en un quiz
router.post('/quizzes/:quizId/questions', async (req, res) => {
  const { quizId } = req.params
  const {
    type, question_text, time_limit_sec, points, media_url,
    question_options, slider_min, slider_max, slider_correct,
    pin_x, pin_y, explanation
  } = req.body

  if (!question_text || !type) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  try {
    const questionId = uuidv4()
    await pool.query(
      `INSERT INTO questions
         (id, quiz_id, type, question_text, time_limit_sec, points,
          media_url, slider_min, slider_max, slider_correct, pin_x, pin_y, explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [questionId, quizId, type, question_text,
       time_limit_sec || 20, points || 1000,
       media_url || null, slider_min || null, slider_max || null,
       slider_correct || null, pin_x || null, pin_y || null,
       explanation || null]
    )

    if (Array.isArray(question_options)) {
      for (let i = 0; i < question_options.length; i++) {
        const opt = question_options[i]
        if (!opt.option_text) continue
        
        // El tipo 'type_answer' fuerza que las opciones guardadas sean respuestas correctas válidas
        const finalIsCorrect = type === 'type_answer' ? true : !!opt.is_correct

        await pool.query(
          `INSERT INTO question_options (question_id, option_text, is_correct, position, match_group)
           VALUES ($1,$2,$3,$4,$5)`,
          [questionId, opt.option_text, finalIsCorrect, opt.position ?? i, opt.match_group || null]
        )
      }
    }

    const result = await pool.query('SELECT * FROM questions WHERE id = $1', [questionId])
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear la pregunta' })
  }
})

// PUT: Actualizar una pregunta
router.put('/questions/:id', async (req, res) => {
  const { id } = req.params
  const {
    type, question_text, time_limit_sec, points, media_url,
    question_options, slider_min, slider_max, slider_correct,
    pin_x, pin_y, explanation
  } = req.body

  if (!question_text || !type) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const updateResult = await client.query(
      `UPDATE questions
       SET type = $1, question_text = $2, time_limit_sec = $3, points = $4,
           media_url = $5, slider_min = $6, slider_max = $7, slider_correct = $8,
           pin_x = $9, pin_y = $10, explanation = $11
       WHERE id = $12 RETURNING *`,
      [type, question_text, time_limit_sec || 20, points || 1000,
       media_url || null, slider_min || null, slider_max || null,
       slider_correct || null, pin_x || null, pin_y || null,
       explanation || null, id]
    )

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Pregunta no encontrada' })
    }

    if (Array.isArray(question_options)) {
      const incomingIds = question_options.filter(o => o.id).map(o => o.id)

      if (incomingIds.length > 0) {
        await client.query(
          `DELETE FROM player_answers
           WHERE answer_option_id IN (
             SELECT id FROM question_options
             WHERE question_id = $1 AND id NOT IN (SELECT unnest($2::uuid[]))
           )`,
          [id, incomingIds]
        )
        await client.query(
          `DELETE FROM question_options
           WHERE question_id = $1 AND id NOT IN (SELECT unnest($2::uuid[]))`,
          [id, incomingIds]
        )
      } else {
        await client.query('DELETE FROM player_answers WHERE question_id = $1', [id])
        await client.query('DELETE FROM question_options WHERE question_id = $1', [id])
      }

      for (let i = 0; i < question_options.length; i++) {
        const opt = question_options[i]
        if (!opt.option_text) continue

        // El tipo 'type_answer' fuerza que las opciones guardadas sean respuestas correctas válidas
        const finalIsCorrect = type === 'type_answer' ? true : !!opt.is_correct

        if (opt.id) {
          await client.query(
            `UPDATE question_options
             SET option_text = $1, is_correct = $2, position = $3, match_group = $4
             WHERE id = $5 AND question_id = $6`,
            [opt.option_text, finalIsCorrect, opt.position ?? i, opt.match_group || null, opt.id, id]
          )
        } else {
          await client.query(
            `INSERT INTO question_options (question_id, option_text, is_correct, position, match_group)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, opt.option_text, finalIsCorrect, opt.position ?? i, opt.match_group || null]
          )
        }
      }
    }

    await client.query('COMMIT')
    res.json(updateResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error en PUT /questions:', err)
    res.status(500).json({ error: 'No se pudo actualizar la pregunta', details: err.message })
  } finally {
    client.release()
  }
})

// DELETE: Eliminar una pregunta
router.delete('/questions/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM player_answers WHERE question_id = $1', [id])
    await client.query('DELETE FROM question_options WHERE question_id = $1', [id])
    const result = await client.query('DELETE FROM questions WHERE id = $1', [id])
    if (result.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'La pregunta no existe' })
    }
    await client.query('COMMIT')
    res.json({ success: true, message: 'Pregunta eliminada con éxito' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar la pregunta' })
  } finally {
    client.release()
  }
})

module.exports = router
