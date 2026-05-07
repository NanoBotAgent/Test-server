const mineflayer = require('mineflayer')
const express = require('express')
const { WebSocketServer } = require('ws')

const app = express()
app.use(express.json())

let bot = null
const clients = new Set()

function broadcast(msg) {
  const data = JSON.stringify(msg)
  clients.forEach(c => c.readyState === 1 && c.send(data))
}

function createBot() {
  bot = mineflayer.createBot({
    host: process.env.MC_HOST || 'localhost',
    port: parseInt(process.env.PROXY_PORT) || 25566, // ViaProxy
    username: process.env.MC_USERNAME || 'BotName',
    version: '1.21.11' // ViaProxy translates this to 26.1.x
  })

  bot.once('spawn', () => {
    console.log('Bot spawned')
    broadcast({ event: 'spawn' })
  })

  bot.on('chat', (username, message) => {
    console.log(`<${username}> ${message}`)
    broadcast({ event: 'chat', username, message })
  })

  bot.on('death', () => {
    broadcast({ event: 'death' })
    bot.respawn()
  })

  bot.on('kicked', reason => {
    console.log('Kicked:', reason)
    broadcast({ event: 'kicked', reason })
    setTimeout(createBot, 5000) // auto reconnect
  })

  bot.on('error', err => {
    console.error('Error:', err.message)
    broadcast({ event: 'error', message: err.message })
  })
}

// ── REST API ──────────────────────────────────────────────

// GET /status — bot health, position, players online
app.get('/status', (req, res) => {
  if (!bot?.entity) return res.status(503).json({ online: false })
  res.json({
    online: true,
    username: bot.username,
    health: bot.health,
    food: bot.food,
    position: bot.entity.position,
    players: Object.keys(bot.players)
  })
})

// POST /chat — send a chat message
// curl -X POST https://your-app.onrender.com/chat -H "Content-Type: application/json" -d '{"message":"hello"}'
app.post('/chat', (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })
  bot.chat(message)
  res.json({ sent: message })
})

// POST /move — move in a direction for ms milliseconds
// curl -X POST https://your-app.onrender.com/move -H "Content-Type: application/json" -d '{"direction":"forward","ms":2000}'
app.post('/move', (req, res) => {
  const { direction = 'forward', ms = 1000 } = req.body
  bot.setControlState(direction, true)
  setTimeout(() => bot.setControlState(direction, false), ms)
  res.json({ moving: direction, ms })
})

// POST /stop — stop all movement
// curl -X POST https://your-app.onrender.com/stop
app.post('/stop', (req, res) => {
  bot.clearControlStates()
  res.json({ stopped: true })
})

// POST /look — look toward coordinates
// curl -X POST https://your-app.onrender.com/look -H "Content-Type: application/json" -d '{"yaw":0,"pitch":0}'
app.post('/look', (req, res) => {
  const { yaw = 0, pitch = 0 } = req.body
  bot.look(yaw, pitch, true)
  res.json({ yaw, pitch })
})

// POST /attack — attack nearest entity
// curl -X POST https://your-app.onrender.com/attack
app.post('/attack', (req, res) => {
  const entity = bot.nearestEntity()
  if (!entity) return res.status(404).json({ error: 'no entity nearby' })
  bot.attack(entity)
  res.json({ attacked: entity.displayName || entity.type })
})

// ── WebSocket (real-time terminal stream) ─────────────────
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`API running on port ${process.env.PORT || 3000}`)
})

const wss = new WebSocketServer({ server })
wss.on('connection', ws => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  // terminal can send commands via WS too
  ws.on('message', data => {
    try {
      const { action, payload } = JSON.parse(data)
      if (action === 'chat') bot.chat(payload)
    } catch {}
  })
})

createBot()
