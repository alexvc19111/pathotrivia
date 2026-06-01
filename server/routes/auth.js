const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool')

const router = express.Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
  }

  try {
    const result = await pool.query('SELECT id, username, password FROM admins WHERE username = $1', [username])
    const admin = result.rows[0]
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const passwordMatches = await bcrypt.compare(password, admin.password)
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const token = jwt.sign({ adminId: admin.id, username: admin.username }, process.env.JWT_SECRET, {
      expiresIn: '8h'
    })

    res.json({ token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

module.exports = router
