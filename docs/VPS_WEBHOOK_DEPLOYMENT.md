# VPS Webhook Deployment

WarungPilot AI can expose the DOKU payment webhook through the SumoPod VPS.
The VPS is used as a public HTTPS endpoint for DOKU callbacks and demo access.

## Current VPS Layout

```txt
App directory: /home/ubuntu/WarungPilotAI
App service:   warungpilot
Tunnel service: warungpilot-tunnel
App port:      127.0.0.1:3001
```

Cloudflare quick tunnel is used because `sslip.io` hit a Let's Encrypt
registered-domain rate limit during setup.

## Useful Commands

```bash
sudo systemctl status warungpilot
sudo systemctl status warungpilot-tunnel
sudo journalctl -u warungpilot -n 100 --no-pager
sudo journalctl -u warungpilot-tunnel -n 100 --no-pager
```

Get the active tunnel URL:

```bash
sudo journalctl -u warungpilot-tunnel --no-pager -n 100 \
  | grep -o 'https://[^ ]*trycloudflare.com' \
  | tail -1
```

Restart after `.env.local` changes:

```bash
sudo systemctl restart warungpilot
```

## DOKU URLs

When the tunnel URL is active, use:

```txt
DOKU_CALLBACK_URL=<tunnel-url>/api/payments/doku/return
DOKU_NOTIFICATION_URL=<tunnel-url>/api/payments/doku/notification
```

Quick tunnel URLs can change after restart. If the URL changes, update DOKU
Dashboard and the VPS `.env.local`, then restart `warungpilot`.

For production, replace quick tunnel with a named Cloudflare Tunnel or a real
domain so the webhook URL stays stable.
