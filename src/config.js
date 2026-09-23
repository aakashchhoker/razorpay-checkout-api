import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

function parseJsonEnv(name, fallback) {
  const raw = process.env[name]
  if (!raw || !String(raw).trim()) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    console.warn(`[config] Invalid JSON in ${name}, using fallback`)
    return fallback
  }
}

const defaultPlans = {
  proMonth: { title: 'Monthly', amountPaise: 9900, currency: 'INR' },
  proYear: { title: 'Yearly', amountPaise: 79900, currency: 'INR' },
  removeAds: { title: 'Lifetime', amountPaise: 199900, currency: 'INR' },
}

export const config = {
  port: Number(process.env.PORT || 8787),
  nodeEnv: process.env.NODE_ENV || 'development',
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  checkoutApiKey: process.env.CHECKOUT_API_KEY || '',
  businessName: process.env.BUSINESS_NAME || 'Checkout',
  corsOrigins: String(process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  plans: parseJsonEnv('PLANS_JSON', defaultPlans),
  demoPayments:
    process.env.DEMO_PAYMENTS === 'true' ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET ||
    /REPLACE|DEMO|your_/i.test(process.env.RAZORPAY_KEY_ID || '') ||
    /REPLACE|DEMO|your_/i.test(process.env.RAZORPAY_KEY_SECRET || ''),
}

export function getPlan(planId) {
  if (!planId) return null
  const plan = config.plans[planId]
  if (!plan) return null
  return {
    id: planId,
    title: plan.title || planId,
    amountPaise: Number(plan.amountPaise),
    currency: plan.currency || 'INR',
  }
}

export function listPublicPlans() {
  return Object.entries(config.plans).map(([id, plan]) => ({
    id,
    title: plan.title || id,
    amountPaise: Number(plan.amountPaise),
    currency: plan.currency || 'INR',
    priceLabel:
      plan.priceLabel ||
      `₹${(Number(plan.amountPaise) / 100).toLocaleString('en-IN')}`,
  }))
}
