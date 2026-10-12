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
  proMonth: { title: 'Monthly', amountMinorUnits: 500, currency: 'USD' },
  proYear: { title: 'Yearly', amountMinorUnits: 1000, currency: 'USD' },
  removeAds: { title: 'Lifetime', amountMinorUnits: 2000, currency: 'USD' },
}

const defaultIndiaPlans = {
  proMonth: { title: 'Monthly', amountMinorUnits: 9900, currency: 'INR' },
  proYear: { title: 'Yearly', amountMinorUnits: 49900, currency: 'INR' },
  removeAds: { title: 'Lifetime', amountMinorUnits: 99900, currency: 'INR' },
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
  indiaPlans: parseJsonEnv('PLANS_INR_JSON', defaultIndiaPlans),
  demoPayments:
    process.env.DEMO_PAYMENTS === 'true' ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET ||
    /REPLACE|DEMO|your_/i.test(process.env.RAZORPAY_KEY_ID || '') ||
    /REPLACE|DEMO|your_/i.test(process.env.RAZORPAY_KEY_SECRET || ''),
}

export function getCountryCode(req) {
  const country = [
    req?.headers?.['cf-ipcountry'],
    req?.headers?.['x-vercel-ip-country'],
    req?.headers?.['cloudfront-viewer-country'],
  ].find((value) => typeof value === 'string' && /^[a-z]{2}$/i.test(value))

  if (!country || ['XX', 'T1'].includes(country.toUpperCase())) return null
  return country.toUpperCase()
}

function plansForCountry(countryCode) {
  return countryCode === 'IN' ? config.indiaPlans : config.plans
}

function formatPrice(amountMinorUnits, currency) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amountMinorUnits) / 100)
}

export function getPlan(planId, countryCode = null) {
  if (!planId) return null
  const plan = plansForCountry(countryCode)[planId]
  if (!plan) return null
  return {
    id: planId,
    title: plan.title || planId,
    amountMinorUnits: Number(plan.amountMinorUnits),
    currency: plan.currency || (countryCode === 'IN' ? 'INR' : 'USD'),
  }
}

export function listPublicPlans(countryCode = null) {
  const plans = plansForCountry(countryCode)
  return Object.entries(plans).map(([id, plan]) => ({
    id,
    title: plan.title || id,
    amountMinorUnits: Number(plan.amountMinorUnits),
    currency: plan.currency || (countryCode === 'IN' ? 'INR' : 'USD'),
    priceLabel: plan.priceLabel || formatPrice(
      plan.amountMinorUnits,
      plan.currency || (countryCode === 'IN' ? 'INR' : 'USD'),
    ),
  }))
}
