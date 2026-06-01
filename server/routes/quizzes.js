const express = require('express')
const pool    = require('../db/pool')
const { requireAuth } = require('../middleware/authMiddleware')
const { v4: uuidv4 }  = require('uuid')

const router = express.Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.id, q.title, q.description, q.created_at, q.updated_at,
              COUNT(questions.id) AS question_count
       FROM quizzes q
       LEFT JOIN questions ON questions.quiz_id = q.id
       WHERE q.admin_id = $1
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
      [req.admin.adminId]
    )
    res.json(result.rows.map(row => ({ ...row, question_count: Number(row.question_count) })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudieron obtener los quizzes' })
  }
})

router.post('/', async (req, res) => {
  const { title, description } = req.body
  if (!title) return res.status(400).json({ error: 'El título es obligatorio' })
  try {
    const insert = await pool.query(
      `INSERT INTO quizzes (id, title, description, admin_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, cover_image, created_at, updated_at`,
      [uuidv4(), title, description || '', req.admin.adminId]
    )
    res.status(201).json(insert.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo crear el quiz' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await pool.query('DELETE FROM quizzes WHERE id = $1 AND admin_id = $2', [id, req.admin.adminId])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'No se pudo eliminar el quiz' })
  }
})



module.exports = router