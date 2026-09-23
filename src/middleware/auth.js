/**
 * Optional API key for apps calling this service.
 * Set CHECKOUT_API_KEY on the server; send header X-Checkout-Key from clients.
 * If CHECKOUT_API_KEY is empty, requests are allowed (local demo only).
 */
export function requireCheckoutKey(req, res, next) {
  const expected = process.env.CHECKOUT_API_KEY || ''
  if (!expected) return next()

  const got =
    req.headers['x-checkout-key'] ||
    req.headers['x-api-key'] ||
    (String(req.headers.authorization || '').startsWith('Bearer ')
      ? String(req.headers.authorization).slice(7)
      : '')

  if (got !== expected) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized — send header X-Checkout-Key',
    })
  }
  return next()
}
