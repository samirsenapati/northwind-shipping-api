# Northwind Shipping API

The REST API behind **Northwind**, shipping software for online stores. With it you can create shipments, compare live rates across carriers, buy and void labels, track parcels, handle returns and exchanges, and receive signed webhook events.

- **Docs:** https://northwind-labs.docora.200-97-163-217.sslip.io
- **API reference:** https://northwind-labs.docora.200-97-163-217.sslip.io/api-reference

> This repository is a self-contained implementation of the API for demos and local development. Data lives in memory and the carriers are simulated, so it runs with one command and no accounts.

## Features

- **Rate shopping** across USPS, UPS, FedEx and DHL Express, cheapest first, with billable (dimensional) weight
- **Labels** as PDF or 4x6 ZPL; labels bought with a test key are free
- **Voids** for unused labels within 30 days of purchase
- **Tracking** with a full scan timeline, an estimated delivery date and delivery exceptions (`exception_code`)
- **Scheduled pickups**: book a carrier driver to collect labelled parcels, and cancel until the window starts
- **Returns** with a refund, store credit or an exchange, inside a 30-day window, with a prepaid return label
- **Webhooks** signed with HMAC-SHA256 (`Northwind-Signature`) and retried with backoff for up to 3 days
- **Idempotency keys** on every POST, cursor pagination and per-key rate limits

## Quick start

Requires Node.js 20 or later.

```bash
git clone https://github.com/samirsenapati/northwind-shipping-api.git
cd northwind-shipping-api
npm install
npm run dev
```

The API listens on `http://localhost:3000`. Every `/v1` request needs an API key in the `Authorization` header. The local test key is `nw_test_localdevelopment01`; set `NORTHWIND_TEST_KEY` to use your own.

### Create a shipment

```bash
curl http://localhost:3000/v1/shipments \
  -H "Authorization: Bearer nw_test_localdevelopment01" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-1042-shipment" \
  -d '{
    "order_id": "ord_7Hk3Pz9Rm2",
    "to_address": {"name": "Maya Chen", "street1": "48 Orchard Lane", "city": "Portland", "state": "OR", "zip": "97205", "country": "US"},
    "from_address": {"name": "Juniper Goods", "street1": "2100 Industrial Pkwy", "city": "Columbus", "state": "OH", "zip": "43215", "country": "US"},
    "parcels": [{"length": 10, "width": 8, "height": 4, "dimension_unit": "in", "weight": 2.5, "weight_unit": "lb"}]
  }'
```

The response lists a rate from every carrier that serves the route, cheapest first (shortened here):

```json
{
  "id": "shp_yQP9QuuGsr",
  "object": "shipment",
  "status": "rated",
  "rates": [
    {"id": "rate_VG7EXgfcDX", "carrier": "USPS", "service": "Ground Advantage", "amount": "8.69", "currency": "USD", "delivery_days": 5},
    {"id": "rate_z8YfygDPV6", "carrier": "USPS", "service": "Priority Mail", "amount": "14.04", "currency": "USD", "delivery_days": 3},
    {"id": "rate_x3UwbYY2aG", "carrier": "FedEx", "service": "Ground", "amount": "16.74", "currency": "USD", "delivery_days": 4}
  ],
  "label": null,
  "mode": "test"
}
```

### Buy the label

```bash
curl http://localhost:3000/v1/shipments/shp_yQP9QuuGsr/labels \
  -H "Authorization: Bearer nw_test_localdevelopment01" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-1042-label" \
  -d '{"rate_id": "rate_z8YfygDPV6"}'
```

```json
{
  "id": "lbl_dxXzEfKeKG",
  "object": "label",
  "shipment_id": "shp_yQP9QuuGsr",
  "status": "purchased",
  "carrier": "USPS",
  "service": "Priority Mail",
  "tracking_number": "9405796630082449054095",
  "label_url": "https://labels.northwind.example/9405796630082449054095.pdf",
  "format": "pdf",
  "amount": "0.00",
  "currency": "USD"
}
```

### Track it

```bash
curl http://localhost:3000/v1/trackers/9405796630082449054095 \
  -H "Authorization: Bearer nw_test_localdevelopment01"
```

In test mode a simulator scans each parcel every 10 minutes (in transit, out for delivery, delivered), so you receive the same `tracking.updated` and `shipment.delivered` events as in live mode.

### Schedule a pickup

Book a driver to collect labelled parcels instead of dropping them off. All shipments in one pickup must use the same carrier and leave from the same address. The window is in Unix seconds, starts at least 2 hours from now and within 7 days, and lasts at least 2 hours.

```bash
curl http://localhost:3000/v1/pickups \
  -H "Authorization: Bearer nw_test_localdevelopment01" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pickup-2026-11-06" \
  -d '{
    "shipment_ids": ["shp_yQP9QuuGsr"],
    "pickup_window": {"start": 1793973600, "end": 1793984400},
    "instructions": "Side door, ring twice"
  }'
```

The response includes the carrier's `confirmation` number and the `fee` (USPS pickups are free; UPS charges $7.50 and FedEx $5.00 per pickup; test pickups are always free). Cancel with `POST /v1/pickups/:id/cancel` any time before the window starts.

## Endpoints

All paths are relative to `/v1`.

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/shipments` | Create a shipment and get rates from every carrier on the route |
| GET | `/shipments` | List shipments, newest first; filter by `status` |
| GET | `/shipments/:id` | Retrieve a shipment |
| POST | `/shipments/:id/labels` | Buy the label for one of the shipment's rates |
| POST | `/labels/:id/void` | Void an unused label for a refund |
| GET | `/trackers/:tracking_number` | Tracking status, estimated delivery and scan history |
| POST | `/pickups` | Book a carrier pickup for labelled shipments |
| GET | `/pickups/:id` | Retrieve a pickup |
| POST | `/pickups/:id/cancel` | Cancel a pickup before its window starts |
| POST | `/returns` | Start a return with a refund, store credit or exchange |
| GET | `/returns` | List returns |
| GET | `/returns/:id` | Retrieve a return |
| GET | `/orders` | List orders from connected stores; filter by `status` |
| GET | `/orders/:id` | Retrieve an order |
| POST | `/webhook_endpoints` | Register a URL to receive events |
| GET | `/webhook_endpoints` | List webhook endpoints |
| DELETE | `/webhook_endpoints/:id` | Delete a webhook endpoint |

Object IDs carry a prefix that says what they are: `shp_` shipment, `rate_` rate, `lbl_` label, `trk_` tracker, `pku_` pickup, `ret_` return, `ord_` order, `we_` webhook endpoint, `evt_` event.

## Errors

Every error has the same shape. `param` names the field to fix, when there is one.

```json
{
  "error": {
    "type": "invalid_request",
    "code": "address_unverified",
    "message": "The destination address could not be verified. US ZIP codes have 5 digits, or 5+4 like 97205-1234.",
    "param": "to_address.zip"
  }
}
```

| Type | Status | Retry? |
| --- | --- | --- |
| `invalid_request` | 400 | No: fix the request |
| `authentication_error` | 401 | No: check the API key |
| `permission_error` | 403 | No |
| `not_found` | 404 | No: check the ID and its prefix |
| `rate_limited` | 429 | Yes, after `Retry-After` seconds |
| `carrier_error` | 502 | Yes, or choose another carrier's rate |

Retry with the same `Idempotency-Key` as the first attempt. A replayed response carries `Idempotent-Replayed: true`.

## Rate limits and pagination

Each key can make 600 requests a minute (1,200 on the Scale plan). Every response reports `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

List endpoints return `{"object": "list", "data": [...], "has_more": true}`. Pass `limit` (1-100, default 10) and `starting_after` set to the last ID you received to get the next page.

## Webhooks

Register an endpoint with `POST /v1/webhook_endpoints` and keep the `secret` from the response. Events:

`order.created`, `shipment.created`, `label.purchased`, `tracking.updated`, `shipment.delivered`, `shipment.exception`, `return.requested`, `return.received`, `return.refunded`, `pickup.scheduled`, `pickup.cancelled`

Each delivery carries `Northwind-Signature: t=<timestamp>,v1=<signature>`, where the signature is the hex HMAC-SHA256 of `<timestamp>.<raw body>` keyed with the endpoint secret. Verify it against the raw bytes before parsing JSON, and reject timestamps more than 5 minutes old. `verifySignature` in [`src/services/webhooks.ts`](src/services/webhooks.ts) is a complete reference implementation.

Respond with any 2xx within 10 seconds. Failed deliveries are retried after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and then every 12 hours, for up to 3 days, so de-duplicate on the event `id`.

## Configuration

Settings come from environment variables; the defaults work for local development. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `NORTHWIND_TEST_KEY` | `nw_test_localdevelopment01` | Test-mode API key |
| `NORTHWIND_LIVE_KEY` | (empty) | Live-mode API key; leave empty for test mode only |
| `RATE_LIMIT_PER_MINUTE` | `600` | Requests per minute per key |
| `SCALE_RATE_LIMIT_PER_MINUTE` | `1200` | The same, for keys on the Scale plan |
| `RETURN_WINDOW_DAYS` | `30` | Days after fulfilment that a return can start |
| `WEBHOOK_MAX_RETRY_HOURS` | `72` | How long failed deliveries are retried |

## Project layout

```text
src/
  app.ts               HTTP app: middleware order and routes
  server.ts            Entry point; starts the test-mode tracking simulator
  config.ts            Environment settings and their defaults
  context.ts           Store, clock and webhook dispatcher passed to every route
  routes/              One router per resource (shipments, labels, trackers, pickups, returns, orders, webhook endpoints)
  services/            Business rules: rating, labels, tracking, pickups, returns, webhooks, address checks
    carriers/          Carrier adapters (simulated USPS, UPS, FedEx, DHL Express)
  middleware/          Auth, rate limiting, idempotency, error responses
  validation/          Request schemas (zod)
  store/               In-memory storage and seed orders
  jobs/                Test-mode tracking simulator
test/                  API tests (vitest + supertest)
```

## Development

```bash
npm test            # run the test suite
npm run typecheck   # type-check src and tests
npm run build       # compile to dist/
npm start           # run the compiled server
```

### Docker

```bash
docker build -t northwind-api .
docker run -p 3000:3000 --env-file .env northwind-api
```
