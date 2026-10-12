/**
 * Drop-in browser client for razorpay-checkout-api
 * Copy this file into any frontend, or import from examples.
 *
 * Usage:
 *   import { createPayClient } from './payClient.js'
 *   const pay = createPayClient({
 *     baseUrl: 'https://your-api.onrender.com',
 *     apiKey: 'your-CHECKOUT_API_KEY',
 *   })
 *   await pay.checkout({ planId: 'proMonth', name: 'My App' })
 */

export function createPayClient({
  baseUrl,
  apiKey = '',
  businessName = 'Checkout',
  themeColor = '#0ea5e9',
} = {}) {
  const root = String(baseUrl || '').replace(/\/$/, '')
  if (!root) throw new Error('createPayClient: baseUrl is required')

  function headers() {
    const h = { 'Content-Type': 'application/json' }
    if (apiKey) h['X-Checkout-Key'] = apiKey
    return h
  }

  async function api(path, options = {}) {
    let res
    try {
      res = await fetch(`${root}${path}`, {
        ...options,
        headers: { ...headers(), ...(options.headers || {}) },
      })
    } catch {
      throw new Error('Payment API unreachable. Is razorpay-checkout-api running / deployed?')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `Request failed (${res.status})`)
    }
    return data
  }

  async function loadRazorpay() {
    if (typeof window === 'undefined') return false
    if (window.Razorpay) return true
    return new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.async = true
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.body.appendChild(s)
    })
  }

  async function getConfig() {
    return api('/v1/config')
  }

  async function createOrder(planId, extra = {}) {
    return api('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ planId, ...extra }),
    })
  }

  async function verifyPayment(payload) {
    return api('/v1/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  function openCheckout({ keyId, order, plan, demo, name, description, onDismiss }) {
    return new Promise(async (resolve, reject) => {
      try {
        if (demo) {
          await new Promise((r) => setTimeout(r, 400))
          resolve({
            demo: true,
            razorpay_order_id: order.id,
            razorpay_payment_id: `pay_demo_${Date.now()}`,
            razorpay_signature: 'demo_signature',
          })
          return
        }

        const ok = await loadRazorpay()
        if (!ok || !window.Razorpay) {
          reject(new Error('Could not load Razorpay Checkout'))
          return
        }

        const rzp = new window.Razorpay({
          key: keyId,
          amount: order.amount,
          currency: order.currency || 'USD',
          name: name || businessName,
          description: description || plan?.title || 'Payment',
          order_id: order.id,
          theme: { color: themeColor },
          handler(response) {
            resolve({ demo: false, ...response })
          },
          modal: {
            confirm_close: true,
            ondismiss() {
              onDismiss?.()
              reject(new Error('Payment cancelled'))
            },
          },
        })

        rzp.on('payment.failed', (response) => {
          reject(
            new Error(
              response?.error?.description ||
                response?.error?.reason ||
                'Payment failed',
            ),
          )
        })

        rzp.open()
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Full flow: create order → Razorpay UI → verify → { unlocked, paymentId, planId, demo }
   */
  async function checkout({
    planId,
    name,
    description,
    notes,
    onDismiss,
  }) {
    const orderRes = await createOrder(planId, { notes })
    const payment = await openCheckout({
      keyId: orderRes.keyId,
      order: orderRes.order,
      plan: orderRes.plan,
      demo: orderRes.demo,
      name: name || orderRes.businessName || businessName,
      description,
      onDismiss,
    })
    const verified = await verifyPayment({
      planId,
      demo: Boolean(payment.demo || orderRes.demo),
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
    })
    if (!verified?.unlocked) {
      throw new Error('Payment not confirmed')
    }
    return {
      ok: true,
      demo: Boolean(verified.demo),
      planId: verified.planId,
      paymentId: verified.paymentId,
    }
  }

  return {
    getConfig,
    createOrder,
    verifyPayment,
    openCheckout,
    checkout,
  }
}
