const express  = require('express')
const multer   = require('multer')
const pool     = require('../db/pool')
const { requireAuth }    = require('../middleware/authMiddleware')
const { parsePdfBuffer } = require('../utils/pdfParser')
const { v4: uuidv4 }     = require('uuid')

const router = express.Router()
router.use(requireAuth)

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan archivos PDF'))
    }
  }
})

// ─── POST /:quizId/parse-pdf ─────────────────────────────────────────────────
router.post('/:quizId/parse-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo PDF' })
  try {
    const questions = await parsePdfBuffer(req.file.buffer)
    if (!questions.length) {
      return res.status(422).json({
        error: 'No se detectaron preguntas. Revisa que el PDF siga uno de los formatos soportados.',
        questions: []
      })
    }
    res.json({ questions, total: questions.length })
  } catch (err) {
    console.error('Error parseando PDF:', err)
    res.status(500).json({ error: 'Error procesando el PDF: ' + err.message })
  }
})

// ─── POST /:quizId/import-pdf ─────────────────────────────────────────────────
router.post('/:quizId/import-pdf', express.json(), async (req, res) => {
  const { quizId }    = req.params
  const { questions } = req.body

  if (!Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ error: 'No se recibieron preguntas para importar' })
  }

  const quizCheck = await pool.query(
    'SELECT id FROM quizzes WHERE id = $1 AND admin_id = $2',
    [quizId, req.admin.adminId]
  )
  if (!quizCheck.rowCount) return res.status(404).json({ error: 'Quiz no encontrado' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0

    for (const item of questions) {
      const questionId = uuidv4()
      const type       = item.type || 'multiple_choice'
      const qText      = (item.questionText || item.question_text || item.text || '').trim()
      if (!qText) continue

      await client.query(
        `INSERT INTO questions
           (id, quiz_id, type, question_text, time_limit_sec, points,
            slider_min, slider_max, slider_correct, explanation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          questionId, quizId, type, qText,
          item.timeLimitSec  || item.time_limit_sec || 20,
          item.points        || 1000,
          item.sliderMin     ?? null,
          item.sliderMax     ?? null,
          item.sliderCorrect ?? null,
          item.explanation   || null
        ]
      )

      const options = item.options || item.question_options || []
      for (let i = 0; i < options.length; i++) {
        const opt     = options[i]
        const optText = (opt.optionText || opt.option_text || opt.text || '').trim()
        if (!optText) continue
        await client.query(
          `INSERT INTO question_options
             (question_id, option_text, is_correct, position, match_group)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            questionId, optText,
            !!opt.isCorrect || !!opt.is_correct,
            opt.position ?? i,
            opt.matchGroup || opt.match_group || null
          ]
        )
      }

      if (type === 'type_answer' && item.correctAnswer && !options.length) {
        await client.query(
          `INSERT INTO question_options (question_id, option_text, is_correct, position)
           VALUES ($1,$2,true,0)`,
          [questionId, item.correctAnswer.trim()]
        )
      }

      imported++
    }

    await client.query('COMMIT')
    res.status(201).json({ imported, total: questions.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error importando preguntas:', err)
    res.status(500).json({ error: 'Error importando preguntas: ' + err.message })
  } finally {
    client.release()
  }
})

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('PDF')) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

module.exports = router