# Razorpay Checkout API

Universal payment backend for **Razorpay** (Card · UPI · Wallet · Netbanking).

Deploy **once** on [Render](https://render.com), then connect **any** frontend in a few steps.
Safe for a **public GitHub repo** — secrets stay in host env vars, never in code.

---

## Why this exists

Razorpay **Key Secret** must never live in the browser.  
This small API creates orders + verifies payments. Your apps only send a `planId`.

---

## 3-step setup (any project)

### 1) Deploy this API (Render)

1. Push this repo to GitHub (public is fine)
2. Render → **New → Web Service** → connect repo  
   - Build: `npm install`  
   - Start: `npm start`  
   - Or use `render.yaml`
3. Set env vars (from `.env.example`):

| Variable | Required | Notes |
|----------|----------|--------|
| `RAZORPAY_KEY_ID` | Yes | `rzp_test_…` or `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | Yes | Server only |
| `CHECKOUT_API_KEY` | Recommended | Random string; apps send as `X-Checkout-Key` |
| `CORS_ORIGINS` | Yes in prod | e.g. `https://myapp.vercel.app,http://localhost:5173` |
| `PLANS_JSON` | Yes | Your prices (see below) |
| `BUSINESS_NAME` | Optional | Shown on Checkout |
| `DEMO_PAYMENTS` | Optional | `true` = fake unlock (local only) |

Copy your Render URL, e.g. `https://razorpay-checkout-api.onrender.com`

### 2) Define plans (server-side amounts)

```json
{
  "proMonth": { "title": "Monthly", "amountPaise": 9900, "currency": "INR" },
  "proYear": { "title": "Yearly", "amountPaise": 79900, "currency": "INR" },
  "removeAds": { "title": "Lifetime", "amountPaise": 199900, "currency": "INR" }
}
```

`amountPaise` = rupees × 100. Clients **cannot** change the price — only send `planId`.

### 3) Call from your frontend

Copy [`client/payClient.js`](./client/payClient.js) into your app:

```js
import { createPayClient } from './payClient.js'

const pay = createPayClient({
  baseUrl: import.meta.env.VITE_PAYMENT_API_URL,
  apiKey: import.meta.env.VITE_CHECKOUT_API_KEY,
})

// After user picks a plan:
const result = await pay.checkout({
  planId: 'proMonth',
  name: 'My App',
  description: 'Pro monthly',
})
// result.unlocked path → unlock feature / remove ads
```

App `.env`:

```env
VITE_PAYMENT_API_URL=https://razorpay-checkout-api.onrender.com
VITE_CHECKOUT_API_KEY=same-as-CHECKOUT_API_KEY-on-render
```

That’s it.

---

## API reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | No | Health (root) |
| GET | `/health` | No | Health check |
| GET | `/api/health` | No | Health check (alias) |
| GET | `/v1/config` | `X-Checkout-Key` | Public keyId + plan list |
| POST | `/v1/orders` | `X-Checkout-Key` | Body: `{ planId }` → order + keyId |
| POST | `/v1/payments/verify` | `X-Checkout-Key` | Verify Checkout response |
| POST | `/v1/webhooks` | Razorpay signature | Optional webhook |

Header: `X-Checkout-Key: <CHECKOUT_API_KEY>`

---

## Local development

```bash
cp .env.example .env
# paste Razorpay test keys
npm install
npm run dev
# → http://localhost:8787/health
```

---

## Reuse in another project

1. Same Render API (or new deploy with different `PLANS_JSON` / keys)  
2. Add that app’s origin to `CORS_ORIGINS`  
3. Copy `client/payClient.js` + set `VITE_PAYMENT_API_URL` + `VITE_CHECKOUT_API_KEY`  
4. Call `pay.checkout({ planId })`  

One backend, many frontends.

---

## Security checklist

- [ ] Never put `RAZORPAY_KEY_SECRET` in a frontend repo  
- [ ] Use `CHECKOUT_API_KEY` in production  
- [ ] Restrict `CORS_ORIGINS` to your real domains  
- [ ] Prefer Live keys only after Razorpay website approval  
- [ ] Optional: set webhook URL to `https://YOUR-API/v1/webhooks` (`payment.captured`)

---

## Test cards (Razorpay Test mode)

- Card: `4111 1111 1111 1111`, any future expiry / CVV  
- Or UPI options shown in Checkout  

No real money in Test mode.

---

## License

MIT — use freely in public or private projects.
# razorpay-checkout-api
