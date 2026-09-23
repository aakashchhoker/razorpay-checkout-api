import crypto from 'crypto'
import { Router } from 'express'
import Razorpay from 'razorpay'
import { config, getPlan, listPublicPlans } from '../config.js'
import { requireCheckoutKey } from '../middleware/auth.js'

function getRazorpay() {
  if (config.demoPayments) return null
  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  })
}

export const paymentsRouter = Router()

paymentsRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'razorpay-checkout-api',
    demo: config.demoPayments,
    businessName: config.businessName,
    keyIdPrefix: config.keyId ? config.keyId.slice(0, 12) : null,
  })
})

/** Public-ish config for frontends (no secrets). Still requires API key if configured. */
paymentsRouter.get('/v1/config', requireCheckoutKey, (_req, res) => {
  res.json({
    ok: true,
    demo: config.demoPayments,
    keyId: config.keyId,
    businessName: config.businessName,
    plans: listPublicPlans(),
  })
})

/**
 * Create an order.
 * Body: { planId: string, notes?: object, receipt?: string }
 * Amount always comes from server PLANS_JSON for the planId.
 */
paymentsRouter.post('/v1/orders', requireCheckoutKey, async (req, res) => {
  try {
    const planId = req.body?.planId
    const plan = getPlan(planId)
    if (!plan || !Number.isFinite(plan.amountPaise) || plan.amountPaise <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Unknown or invalid planId. Check PLANS_JSON on the server.',
        availablePlanIds: Object.keys(config.plans),
      })
    }

    const receipt = String(
      req.body?.receipt || `${plan.id}_${Date.now()}`,
    ).slice(0, 40)

    const notes = {
      planId: plan.id,
      ...(req.body?.notes && typeof req.body.notes === 'object'
        ? req.body.notes
        : {}),
    }

    if (config.demoPayments) {
      return res.json({
        ok: true,
        demo: true,
        keyId: config.keyId || 'rzp_test_DEMO',
        businessName: config.businessName,
        order: {
          id: `order_demo_${Date.now()}`,
          amount: plan.amountPaise,
          currency: plan.currency,
          receipt,
        },
        plan: { id: plan.id, title: plan.title },
      })
    }

    const rzp = getRazorpay()
    const order = await rzp.orders.create({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes,
    })

    return res.json({
      ok: true,
      demo: false,
      keyId: config.keyId,
      businessName: config.businessName,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      plan: { id: plan.id, title: plan.title },
    })
  } catch (err) {
    console.error('[orders]', err)
    return res.status(500).json({
      ok: false,
      error: err?.error?.description || err?.message || 'Could not create order',
    })
  }
})

/**
 * Verify Checkout success payload.
 * Body: { planId, razorpay_order_id, razorpay_payment_id, razorpay_signature, demo? }
 */
paymentsRouter.post('/v1/payments/verify', requireCheckoutKey, (req, res) => {
  try {
    const {
      planId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      demo,
    } = req.body || {}

    const plan = getPlan(planId)
    if (!plan) {
      return res.status(400).json({ ok: false, error: 'Unknown planId' })
    }

    if (config.demoPayments || demo) {
      return res.json({
        ok: true,
        demo: true,
        unlocked: true,
        planId: plan.id,
        paymentId: razorpay_payment_id || `pay_demo_${Date.now()}`,
      })
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Missing payment fields' })
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`
    const expected = crypto
      .createHmac('sha256', config.keySecret)
      .update(payload)
      .digest('hex')

    if (expected !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Payment verification failed' })
    }

    return res.json({
      ok: true,
      demo: false,
      unlocked: true,
      planId: plan.id,
      paymentId: razorpay_payment_id,
    })
  } catch (err) {
    console.error('[verify]', err)
    return res.status(500).json({ ok: false, error: 'Verification error' })
  }
})

/** Razorpay webhook (optional). Configure HTTPS URL on Render. */
paymentsRouter.post('/v1/webhooks', (req, res) => {
  try {
    if (config.demoPayments || !config.webhookSecret) {
      return res.json({ ok: true, skipped: true })
    }
    const signature = req.headers['x-razorpay-signature']
    const body = req.rawBody || JSON.stringify(req.body)
    const expected = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(body)
      .digest('hex')
    if (signature !== expected) {
      return res.status(400).json({ ok: false, error: 'Invalid webhook signature' })
    }
    console.log('[webhook]', typeof req.body === 'object' ? req.body.event : 'ok')
    return res.json({ ok: true })
  } catch (err) {
    console.error('[webhook]', err)
    return res.status(500).json({ ok: false, error: 'Webhook error' })
  }
})
