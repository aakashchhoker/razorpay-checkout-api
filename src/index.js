import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { paymentsRouter } from './routes/payments.js'

const app = express()

const originList = config.corsOrigins
const allowAll = originList.includes('*')

app.use(
  cors({
    origin(origin, cb) {
      if (allowAll || !origin) return cb(null, true)
      if (originList.includes(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: false,
  }),
)

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf
    },
  }),
)

app.use(paymentsRouter)

app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ ok: false, error: err.message })
  }
  console.error(err)
  return res.status(500).json({ ok: false, error: 'Server error' })
})

app.listen(config.port, () => {
  console.log(
    `[razorpay-checkout-api] http://localhost:${config.port} (${config.demoPayments ? 'DEMO' : 'LIVE/TEST keys'})`,
  )
  console.log(
    `[razorpay-checkout-api] plans: ${Object.keys(config.plans).join(', ') || '(none)'}`,
  )
})
