require('dotenv').config()
const http    = require('http')
const express = require('express')
const cors    = require('cors')
const { setupWebSocket }  = require('./websocket/gameHandler')
const { initAdmin }       = require('./db/initAdmin')
const authRoutes          = require('./routes/auth')
const quizzesRoutes       = require('./routes/quizzes')
const questionsRoutes     = require('./routes/questions')
const sessionsRoutes      = require('./routes/sessions')
const importRoutes        = require('./routes/import')

const app = express()
app.use(cors())

app.use(express.json({ limit: '1mb' }))

app.use('/api/auth',     authRoutes)
app.use('/api/quizzes',  quizzesRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api',          questionsRoutes)

app.use('/api/quizzes',  importRoutes)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' })
})

const server = http.createServer(app)
setupWebSocket(server)

const port = process.env.PORT || 4000
server.listen(port, async () => {
  console.log(`Servidor backend iniciado en puerto ${port}`)
  await initAdmin()
})
