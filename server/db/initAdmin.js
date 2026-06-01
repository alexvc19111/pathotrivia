const bcrypt = require('bcryptjs')
const pool   = require('./pool')

async function initAdmin() {
  try {
    const exists = await pool.query(
      'SELECT id FROM admins WHERE username = $1',
      ['Admin']
    )
    if (exists.rowCount > 0) return // ya existe, nada que hacer

    const hash = await bcrypt.hash('Admin', 12)
    await pool.query(
      'INSERT INTO admins (username, password) VALUES ($1, $2)',
      ['Admin', hash]
    )
    console.log('✅ Usuario Admin creado automáticamente')
  } catch (err) {
    // No detener el servidor si falla; solo avisar
    console.error('⚠️  No se pudo crear el admin inicial:', err.message)
  }
}

module.exports = { initAdmin }
