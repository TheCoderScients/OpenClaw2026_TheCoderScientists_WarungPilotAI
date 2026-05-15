# DOKU Real Payment Setup

WarungPilot AI supports DOKU Checkout with a real server-side payment flow:

1. The Payment Agent creates a payment task.
2. `/api/payments/doku/checkout` creates a DOKU-hosted checkout URL.
3. The customer pays on DOKU.
4. DOKU sends a signed webhook to `/api/payments/doku/notification`.
5. WarungPilot verifies the signature and records the payment event in `.data/doku-payments.json`.
6. `/api/payments/doku/status/[invoice]` can be used as a backup status check.

## Environment

Keep secrets only in `.env.local` or deployment env vars. Never commit real DOKU
credentials.

```env
# sandbox for simulator, production for real money
DOKU_ENV=sandbox

# From DOKU Back Office / Dashboard
DOKU_CLIENT_ID=MCH-...
DOKU_SECRET_KEY=...

# Public URL that DOKU can reach
DOKU_CALLBACK_URL=https://your-domain.com/api/payments/doku/return
DOKU_NOTIFICATION_URL=https://your-domain.com/api/payments/doku/notification

# Payment channels shown on DOKU Checkout.
# QRIS is production-ready. In sandbox, WarungPilot auto-falls back to VA
# because DOKU Sandbox does not support QRIS.
DOKU_PAYMENT_METHOD_TYPES=QRIS,VIRTUAL_ACCOUNT_DOKU
DOKU_PAYMENT_DUE_MINUTES=60
DOKU_AUTO_REDIRECT=false
DOKU_WEBHOOK_VERIFY=true
```

For production money, change only after the sandbox flow succeeds and QRIS is
active in DOKU Dashboard:

```env
DOKU_ENV=production
```

## DOKU Dashboard

Set the webhook / notification URL in DOKU Dashboard:

```txt
https://your-domain.com/api/payments/doku/notification
```

For local judging, expose the app with Cloudflare Tunnel and use the tunnel
domain:

```txt
https://your-tunnel.trycloudflare.com/api/payments/doku/notification
```

DOKU requires notification URLs to be reachable by their servers. `localhost`
will not work for real webhooks.

## Testing

Run the app and create a checkout from the cockpit:

```powershell
npm run dev
```

Then call the status endpoint with the generated invoice number:

```txt
GET /api/payments/doku/status/INV-...
```

Sandbox payments can be completed through DOKU's payment simulator. Production
payments should only be tested with small real transactions and the correct
merchant credentials.

## Safety Rules

- The agent must not send a payment link until the owner approves the action.
- Webhook signature verification should stay enabled.
- Treat DOKU webhook status as the source of truth.
- Ignore `FAILED` checkout notifications for final fulfillment decisions, because
  DOKU Checkout allows customers to retry or switch payment methods.
