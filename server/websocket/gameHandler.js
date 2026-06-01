const { WebSocketServer } = require('ws')
const { URL } = require('url')
const pool = require('../db/pool')

const games = new Map()

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function broadcast(sessionId, payload) {
  const game = games.get(sessionId)
  if (!game) return
  if (game.adminSocket) send(game.adminSocket, payload)
  for (const player of game.playerSockets.values()) {
    if (player.ws) send(player.ws, payload)
  }
}

function broadcastToPlayers(sessionId, payload) {
  const game = games.get(sessionId)
  if (!game) return
  for (const player of game.playerSockets.values()) {
    if (player.ws) send(player.ws, payload)
  }
}

async function loadSessionInfo(sessionId) {
  const result = await pool.query(
    `SELECT s.id, s.quiz_id, s.pin, s.status, q.title AS quiz_title
     FROM game_sessions s
     JOIN quizzes q ON q.id = s.quiz_id
     WHERE s.id = $1`,
    [sessionId]
  )
  return result.rows[0]
}

async function loadSessionPlayers(sessionId) {
  const result = await pool.query(
    `SELECT id, nickname, avatar FROM players WHERE session_id = $1`,
    [sessionId]
  )
  return result.rows
}

async function loadQuestionsForSession(sessionId) {
  const result = await pool.query(
    `SELECT q.* FROM questions q
     WHERE q.quiz_id = (SELECT quiz_id FROM game_sessions WHERE id = $1)
     ORDER BY q.position ASC, q.created_at ASC`,
    [sessionId]
  )
  const questionIds = result.rows.map(r => r.id)
  if (!questionIds.length) return []

  const optionsResult = await pool.query(
    `SELECT * FROM question_options WHERE question_id = ANY($1) ORDER BY position ASC`,
    [questionIds]
  )
  const optionsByQuestion = optionsResult.rows.reduce((acc, opt) => {
    if (!acc[opt.question_id]) acc[opt.question_id] = []
    acc[opt.question_id].push(opt)
    return acc
  }, {})

  return result.rows.map(q => ({ ...q, options: optionsByQuestion[q.id] || [] }))
}

function formatQuestionForClient(question, hideCorrect = true) {
  const options = (question.options || []).map(opt => ({
    id: opt.id,
    optionText: opt.option_text,
    position: opt.position,
    matchGroup: opt.match_group,
    // Solo enviar is_correct al admin, no a los jugadores
    ...(hideCorrect ? {} : { isCorrect: opt.is_correct })
  }))

  return {
    id: question.id,
    type: question.type,
    questionText: question.question_text,
    timeLimitSec: question.time_limit_sec,
    timeLimit: question.time_limit_sec, // alias para el frontend
    points: question.points,
    mediaUrl:    question.media_url,
    sliderMin:   question.slider_min,
    sliderMax:   question.slider_max,
    sliderCorrect: hideCorrect ? undefined : question.slider_correct,
    pinX:        hideCorrect ? undefined : question.pin_x,
    pinY:        hideCorrect ? undefined : question.pin_y,
    // Explicación solo se envía cuando se revelan resultados (hideCorrect=false)
    explanation: hideCorrect ? undefined : (question.explanation || null),
    options
  }
}

async function getPlayerScores(sessionId) {
  const result = await pool.query(
    `SELECT p.id, p.nickname, p.avatar,
            COALESCE(SUM(pa.points_earned), 0) AS score
     FROM players p
     LEFT JOIN player_answers pa ON pa.player_id = p.id
     WHERE p.session_id = $1
     GROUP BY p.id, p.nickname, p.avatar
     ORDER BY score DESC, p.id ASC`,
    [sessionId]
  )
  return result.rows.map((r, i) => ({
    id: r.id,
    nickname: r.nickname,
    avatar: r.avatar,
    score: Number(r.score),
    rank: i + 1
  }))
}

async function broadcastPlayerList(sessionId) {
  const game = games.get(sessionId)
  if (!game) return
  const players = []
  for (const [playerId, player] of game.playerSockets.entries()) {
    players.push({ id: playerId, nickname: player.nickname, avatar: player.avatar })
  }
  // BUG 1 CORREGIDO: antes enviaba { type: 'PLAYERS_UPDATE', data: players }
  // pero el frontend escucha { type: 'PLAYERS_UPDATE', players: [...] }
  broadcast(sessionId, { type: 'PLAYERS_UPDATE', players })
}

async function handleNextQuestion(sessionId) {
  const game = games.get(sessionId)
  if (!game) return

  if (!game.questions.length) {
    game.questions = await loadQuestionsForSession(sessionId)
  }

  game.currentIndex += 1

  if (game.currentIndex >= game.questions.length) {
    await endGame(sessionId)
    return
  }

  game.currentQuestion      = game.questions[game.currentIndex]
  game.answers              = []
  game.phase                = 'question'
  game.questionStartedAt    = Date.now()  // para calcular response_time_ms real

  // Limpiar timer anterior si existe
  if (game.questionTimer) clearTimeout(game.questionTimer)

  // Auto-revelar resultados cuando acaba el tiempo (+ 500ms de margen de red)
  const timeLimitMs = (game.currentQuestion.time_limit_sec * 1000) + 500
  game.questionTimer = setTimeout(() => {
    if (games.get(sessionId)?.phase === 'question') {
      handleShowResults(sessionId)
    }
  }, timeLimitMs)

  await pool.query(
    `UPDATE game_sessions SET status = 'in_progress' WHERE id = $1`,
    [sessionId]
  )

  // BUG 2 CORREGIDO: antes enviaba { type: 'QUESTION', data: {...} }
  // pero el frontend (useGameState) escucha { type: 'QUESTION', index, totalQuestions, question }
  // sin el wrapper "data". Ahora el payload es plano y además:
  // - Al admin le mandamos is_correct para mostrar las respuestas correctas en pantalla
  // - Al jugador NO le mandamos is_correct para que no haga trampa
  const basePayload = {
    type: 'QUESTION',
    index: game.currentIndex,
    totalQuestions: game.questions.length,
    timeLimit: game.currentQuestion.time_limit_sec
  }

  if (game.adminSocket) {
    send(game.adminSocket, {
      ...basePayload,
      question: formatQuestionForClient(game.currentQuestion, false) // con is_correct
    })
  }

  broadcastToPlayers(sessionId, {
    ...basePayload,
    question: formatQuestionForClient(game.currentQuestion, true) // sin is_correct
  })
}

async function handleShowResults(sessionId) {
  const game = games.get(sessionId)
  if (!game || !game.currentQuestion) return

  // Cancelar el timer automático si el admin lo presionó antes de que acabara
  if (game.questionTimer) { clearTimeout(game.questionTimer); game.questionTimer = null }

  // Evitar doble ejecución si el timer y el admin coinciden
  if (game.phase !== 'question') return
  game.phase = 'results'

  const answers = game.answers
  const qType   = game.currentQuestion.type
  const stats = {
    totalAnswers:   answers.length,
    correctAnswers: answers.filter(a => a.is_correct).length,
    distribution:   []
  }

  // Tipos con opciones fijas: contar por answer_option_id
  if (game.currentQuestion.options?.length &&
      ['multiple_choice','true_false','poll'].includes(qType)) {
    const counts = {}
    for (const opt of game.currentQuestion.options) counts[opt.id] = 0
    for (const answer of answers) {
      if (answer.answer_option_id && counts[answer.answer_option_id] != null) {
        counts[answer.answer_option_id]++
      }
    }
    stats.distribution = game.currentQuestion.options.map(opt => {
      const count = counts[opt.id] || 0
      const pct = stats.totalAnswers ? Math.round((count / stats.totalAnswers) * 100) : 0
      return { label: opt.option_text, count, pct, isCorrect: !!opt.is_correct }
    })

  // Puzzle: mostrar cuántos acertaron el orden completo
  } else if (qType === 'puzzle') {
    const correctOrder = JSON.stringify(game.currentQuestion.options.map(o => o.id))
    let correct = 0
    for (const answer of answers) {
      try {
        const submitted = typeof answer.answer_text === 'string'
          ? answer.answer_text
          : JSON.stringify(answer.answer_text)
        if (submitted === correctOrder) correct++
      } catch {}
    }
    const wrong = answers.length - correct
    stats.distribution = [
      { label: 'Orden correcto',    count: correct, pct: stats.totalAnswers ? Math.round(correct/stats.totalAnswers*100) : 0, isCorrect: true  },
      { label: 'Orden incorrecto',  count: wrong,   pct: stats.totalAnswers ? Math.round(wrong/stats.totalAnswers*100)   : 0, isCorrect: false }
    ]

  // Matching: mostrar cuántos emparejaron todo correctamente
  } else if (qType === 'matching') {
    const colA = game.currentQuestion.options.filter(o => (o.match_group ?? o.matchGroup) === 'A')
    const colB = game.currentQuestion.options.filter(o => (o.match_group ?? o.matchGroup) === 'B')
    const correctPairs = colA.reduce((acc, o) => {
      const pair = colB.find(t => Number(t.position) === Number(o.position))
      if (pair) acc[o.id] = pair.id
      return acc
    }, {})
    let correct = 0
    for (const answer of answers) {
      try {
        const matches = typeof answer.answer_text === 'string'
          ? JSON.parse(answer.answer_text)
          : answer.answer_text
        const total   = Object.keys(correctPairs).length
        const hits    = Object.keys(correctPairs).filter(k => matches?.[k] === correctPairs[k]).length
        if (hits === total && total > 0) correct++
      } catch {}
    }
    const wrong = answers.length - correct
    stats.distribution = [
      { label: 'Todos correctos',   count: correct, pct: stats.totalAnswers ? Math.round(correct/stats.totalAnswers*100) : 0, isCorrect: true  },
      { label: 'Con errores',       count: wrong,   pct: stats.totalAnswers ? Math.round(wrong/stats.totalAnswers*100)   : 0, isCorrect: false }
    ]

  // Tipos de respuesta abierta: agrupar por texto
  } else if (['brainstorm','word_cloud','type_answer'].includes(qType)) {
    const counts = {}
    for (const answer of answers) {
      if (!answer.answer_text) continue
      const key = String(answer.answer_text).trim().toLowerCase()
      counts[key] = (counts[key] || 0) + 1
    }
    stats.distribution = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])  // ordenar por frecuencia
      .slice(0, 10)                   // máximo 10 respuestas distintas
      .map(([label, count]) => ({
        label,
        count,
        pct:       stats.totalAnswers ? Math.round((count / stats.totalAnswers) * 100) : 0,
        isCorrect: false
      }))

  // Slider: mostrar valor correcto vs respuestas
  } else if (qType === 'slider') {
    const correct = Number(game.currentQuestion.slider_correct)
    let exactHits = 0
    for (const answer of answers) {
      if (Number(answer.answer_numeric) === correct) exactHits++
    }
    stats.distribution = [
      { label: `Valor correcto: ${correct}`, count: exactHits, pct: stats.totalAnswers ? Math.round(exactHits/stats.totalAnswers*100) : 0, isCorrect: true },
      { label: 'Otros valores',              count: answers.length - exactHits, pct: stats.totalAnswers ? Math.round((answers.length-exactHits)/stats.totalAnswers*100) : 0, isCorrect: false }
    ]
  }

  const players = await getPlayerScores(sessionId)

  // Enviar resultados globales a todos (admin + jugadores)
  // Incluir explanation para que el admin la muestre en pantalla grande
  broadcast(sessionId, {
    type:        'QUESTION_RESULTS',
    stats,
    players,
    explanation: game.currentQuestion?.explanation || null
  })

  // Enviar feedback individual a cada jugador con su correcto/incorrecto y puntos
  const game2 = games.get(sessionId)
  if (game2) {
    for (const [pid, playerData] of game2.playerSockets.entries()) {
      if (!playerData.ws) continue
      const playerAnswer = game2.answers.find(a => a.player_id === pid)
      const rank = players.findIndex(p => p.id === pid) + 1
      send(playerData.ws, {
        type:         'ANSWER_FEEDBACK',
        isCorrect:    playerAnswer ? playerAnswer.is_correct    : null,
        pointsEarned: playerAnswer ? playerAnswer.points_earned : 0,
        rank:         rank || null,
        revealed:     true,
        explanation:  game2.currentQuestion?.explanation || null
      })
    }
  }
}

async function endGame(sessionId) {
  const game = games.get(sessionId)
  if (!game) return
  game.phase = 'finished'

  await pool.query(
    `UPDATE game_sessions SET status = 'finished', finished_at = NOW() WHERE id = $1`,
    [sessionId]
  )

  const players = await getPlayerScores(sessionId)

  // Actualizar final_score y final_rank en BD
  for (const p of players) {
    await pool.query(
      `UPDATE players SET final_score = $1, final_rank = $2 WHERE id = $3`,
      [p.score, p.rank, p.id]
    )
  }

  broadcast(sessionId, { type: 'PODIUM', players })
  broadcast(sessionId, { type: 'GAME_FINISHED' })
}

async function evaluateAnswer(question, answer) {
  let isCorrect = false
  let points = 0
  if (!question) return { isCorrect, points }

  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
    case 'poll': {
      if (!question.options) break
      const input = String(answer.answerOptionId || answer.answerText || '').trim().toLowerCase()
      const option = question.options.find(opt => {
        const dbText = String(opt.option_text).trim().toLowerCase()
        const dbId   = String(opt.id).trim().toLowerCase()
        if (input === dbId)   return true
        if (input === dbText) return true
        if ((input === 'true'  || input === 'boolean_true')  && dbText === 'verdadero') return true
        if ((input === 'false' || input === 'boolean_false') && dbText === 'falso')     return true
        return false
      })
      isCorrect = question.type === 'poll' ? false : !!option?.is_correct
      points    = isCorrect ? question.points : 0
      break
    }
    case 'slider': {
      if (question.slider_correct != null && answer.answerNumeric != null) {
        isCorrect = Number(answer.answerNumeric) === Number(question.slider_correct)
        points    = isCorrect ? question.points : 0
      }
      break
    }
    case 'drop_pin': {
      if (question.pin_x != null && question.pin_y != null &&
          answer.answerPinX != null && answer.answerPinY != null) {
        const dist = Math.sqrt(
          (Number(question.pin_x) - Number(answer.answerPinX)) ** 2 +
          (Number(question.pin_y) - Number(answer.answerPinY)) ** 2
        )
        // Tolerancia de 10% — jugable en móvil con dedo
        // El círculo punteado en el editor muestra ~12% visualmente (margen visual mayor)
        isCorrect = dist <= 10
        // Puntos proporcionales a la precisión: más cerca = más puntos
        if (isCorrect) {
          const accuracy = Math.max(0, 1 - dist / 10)
          points = Math.round(question.points * (0.5 + 0.5 * accuracy))
        }
      }
      break
    }
    case 'puzzle': {
      if (!question.options) break
      const correctOrder = question.options.map(opt => opt.id)
      let submitted = answer.answerText
      if (typeof submitted === 'string') {
        try { submitted = JSON.parse(submitted) } catch { submitted = null }
      }
      if (Array.isArray(submitted)) {
        isCorrect = JSON.stringify(submitted) === JSON.stringify(correctOrder)
        points    = isCorrect ? question.points : 0
      }
      break
    }
    case 'matching': {
      if (!question.options || !answer.answerText) break
      let matches = answer.answerText
      if (typeof matches === 'string') {
        try { matches = JSON.parse(matches) } catch { matches = null }
      }
      if (matches && typeof matches === 'object') {
        const colA = question.options.filter(o => (o.match_group ?? o.matchGroup) === 'A')
        const colB = question.options.filter(o => (o.match_group ?? o.matchGroup) === 'B')
        const correctPairs = colA.reduce((acc, o) => {
          // Buscar par por position coincidente en columna B
          const pair = colB.find(t => Number(t.position) === Number(o.position))
          if (pair) acc[o.id] = pair.id
          return acc
        }, {})
        const total   = Object.keys(correctPairs).length
        const correct = Object.keys(correctPairs).filter(k => matches[k] === correctPairs[k]).length
        isCorrect = total > 0 && correct === total
        points    = isCorrect ? question.points : 0
      }
      break
    }
    // Brainstorm y word_cloud: siempre correcto visualmente, sin puntos
    case 'brainstorm':
    case 'word_cloud': {
      isCorrect = true
      points    = 0
      break
    }
    case 'type_answer': {
      if (!question.options?.length || !answer.answerText) break
      const correct = question.options.find(o => o.is_correct)
      if (correct) {
        const normalize = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ')
        isCorrect = normalize(answer.answerText) === normalize(correct.option_text)
        points    = isCorrect ? question.points : 0
      }
      break
    }
    default:
      break
  }

  return { isCorrect, points }
}

async function storePlayerAnswer(sessionId, playerId, answerMessage) {
  const game = games.get(sessionId)
  if (!game || !game.currentQuestion) return null

  try {
    // Evitar respuesta doble
    const existing = await pool.query(
      `SELECT id FROM player_answers
       WHERE session_id=$1 AND player_id=$2 AND question_id=$3`,
      [sessionId, playerId, game.currentQuestion.id]
    )
    if (existing.rowCount) return null

    const evaluation = await evaluateAnswer(game.currentQuestion, answerMessage)

    // Resolver el UUID real de la opción si viene como booleano o texto
    let resolvedOptionId = answerMessage.answerOptionId || null
    if (resolvedOptionId && game.currentQuestion.options) {
      const input = String(resolvedOptionId).trim().toLowerCase()
      const matched = game.currentQuestion.options.find(opt => {
        const dbText = String(opt.option_text).trim().toLowerCase()
        const dbId   = String(opt.id).trim().toLowerCase()
        if (input === dbId)   return true
        if (input === dbText) return true
        if ((input === 'true'  || input === 'boolean_true')  && dbText === 'verdadero') return true
        if ((input === 'false' || input === 'boolean_false') && dbText === 'falso')     return true
        return false
      })
      resolvedOptionId = matched?.id || null
    }

    const record = {
      session_id:       sessionId,
      player_id:        playerId,
      question_id:      game.currentQuestion.id,
      answer_option_id: resolvedOptionId,
      answer_text:      answerMessage.answerText   || null,
      answer_numeric:   answerMessage.answerNumeric != null ? Number(answerMessage.answerNumeric) : null,
      answer_pin_x:     answerMessage.answerPinX   != null ? Number(answerMessage.answerPinX)    : null,
      answer_pin_y:     answerMessage.answerPinY   != null ? Number(answerMessage.answerPinY)    : null,
      is_correct:       evaluation.isCorrect,
      points_earned:    evaluation.points,
      response_time_ms: game.questionStartedAt
        ? Math.min(Date.now() - game.questionStartedAt, game.currentQuestion.time_limit_sec * 1000)
        : 0
    }

    await pool.query(
      `INSERT INTO player_answers
         (session_id, player_id, question_id, answer_option_id, answer_text,
          answer_numeric, answer_pin_x, answer_pin_y, is_correct, points_earned, response_time_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [record.session_id, record.player_id, record.question_id, record.answer_option_id,
       record.answer_text, record.answer_numeric, record.answer_pin_x, record.answer_pin_y,
       record.is_correct, record.points_earned, record.response_time_ms]
    )

    game.answers.push({ ...record, answer_option_id: resolvedOptionId })
    return record
  } catch (err) {
    console.error('❌ Error en storePlayerAnswer:', err.message)
    return null
  }
}

async function handleConnection(ws) {
  // BUG EXTRA CORREGIDO: ws.upgradeReq no existe en versiones recientes de 'ws'
  // la request se pasa manualmente desde el evento 'upgrade' del server
  const url       = new URL(ws._upgradeReq.url, 'http://localhost')
  const role      = url.searchParams.get('role')
  const sessionId = url.searchParams.get('sessionId')
  const playerId  = url.searchParams.get('playerId')

  if (!sessionId || !role) {
    send(ws, { type: 'ERROR', message: 'Sesión o rol faltante' })
    ws.close()
    return
  }

  let game = games.get(sessionId)
  if (!game) {
    game = {
      adminSocket:     null,
      playerSockets:   new Map(),
      sessionId,
      currentIndex:    -1,
      questions:       [],
      currentQuestion: null,
      answers:         [],
      phase:           'lobby',
      questionTimer:   null   // timeout que dispara showResults al acabar el tiempo
    }
    games.set(sessionId, game)
  }

  if (role === 'admin') {
    game.adminSocket = ws
    const sessionInfo = await loadSessionInfo(sessionId)
    if (!sessionInfo) {
      send(ws, { type: 'ERROR', message: 'Sesión no encontrada' })
      ws.close()
      return
    }
    send(ws, {
      type: 'SESSION_UPDATE',
      session: {
        id: sessionInfo.id,
        pin: sessionInfo.pin,
        status: sessionInfo.status,
        quizTitle: sessionInfo.quiz_title
      }
    })

    // Cargar jugadores que ya estaban conectados (reconexión del admin)
    const players = await loadSessionPlayers(sessionId)
    for (const p of players) {
      if (!game.playerSockets.has(p.id)) {
        game.playerSockets.set(p.id, { ws: null, nickname: p.nickname, avatar: p.avatar })
      }
    }
    await broadcastPlayerList(sessionId)

    // Si el juego ya está en curso, restaurar el estado actual para el admin
    if (game.phase === 'question' && game.currentQuestion) {
      send(ws, {
        type:           'QUESTION',
        index:          game.currentIndex,
        totalQuestions: game.questions.length,
        timeLimit:      game.currentQuestion.time_limit_sec,
        question:       formatQuestionForClient(game.currentQuestion, false)
      })
      send(ws, {
        type:     'ANSWER_COUNT',
        answered: game.answers.length,
        total:    game.playerSockets.size
      })
    } else if (game.phase === 'results') {
      send(ws, { type: 'PHASE_CHANGE', phase: 'results' })
    } else if (game.phase === 'finished') {
      send(ws, { type: 'GAME_FINISHED' })
    }

  } else if (role === 'player') {
    if (!playerId) {
      send(ws, { type: 'ERROR', message: 'Player ID faltante' })
      ws.close()
      return
    }
    const playerResult = await pool.query(
      `SELECT id, nickname, avatar FROM players WHERE id=$1 AND session_id=$2`,
      [playerId, sessionId]
    )
    if (!playerResult.rowCount) {
      send(ws, { type: 'ERROR', message: 'Jugador no encontrado' })
      ws.close()
      return
    }
    const player = playerResult.rows[0]
    game.playerSockets.set(playerId, { ws, nickname: player.nickname, avatar: player.avatar })

    // Si el juego ya está en curso, enviar la pregunta actual al jugador reconectado
    if (game.phase === 'question' && game.currentQuestion) {
      send(ws, {
        type: 'QUESTION',
        index: game.currentIndex,
        totalQuestions: game.questions.length,
        timeLimit: game.currentQuestion.time_limit_sec,
        question: formatQuestionForClient(game.currentQuestion, true)
      })
    }

    await broadcastPlayerList(sessionId)
  }

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message.toString())
      if (!payload?.type) return

      if (role === 'admin') {
        if (payload.type === 'NEXT_QUESTION') await handleNextQuestion(sessionId)
        if (payload.type === 'SHOW_RESULTS')  await handleShowResults(sessionId)
        if (payload.type === 'END_GAME')       await endGame(sessionId)
      }

      if (role === 'player' && payload.type === 'ANSWER') {
        const record = await storePlayerAnswer(sessionId, playerId, payload)
        if (!record) return // respuesta duplicada o error

        // Solo confirmamos recepción — el resultado se revela en SHOW_RESULTS
        send(ws, { type: 'ANSWER_RECEIVED' })

        // Notificar al admin cuántos han respondido
        const game2 = games.get(sessionId)
        if (game2?.adminSocket) {
          send(game2.adminSocket, {
            type:          'ANSWER_COUNT',
            answered:      game2.answers.length,
            total:         game2.playerSockets.size
          })
        }
      }
    } catch (err) {
      console.error('❌ Error procesando mensaje WS:', err)
    }
  })

  ws.on('close', () => {
    if (role === 'player') {
      game.playerSockets.delete(playerId)
      broadcastPlayerList(sessionId)
    }
    if (role === 'admin' && game.adminSocket === ws) {
      game.adminSocket = null
    }
  })
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const parsed = new URL(request.url, `http://${request.headers.host}`)
    if (parsed.pathname !== '/ws') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws._upgradeReq = request   // guardamos la request para leerla en handleConnection
      handleConnection(ws)
    })
  })
}

module.exports = { setupWebSocket }