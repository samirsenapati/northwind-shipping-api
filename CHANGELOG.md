# Changelog

All notable changes to the Northwind API. The API follows semantic versioning; additive changes never break existing integrations.

## [1.4.0] - 2026-11-05

### Added

- Scheduled pickups: `POST /v1/pickups` books a carrier driver to collect labelled shipments from one address, `GET /v1/pickups/:id` retrieves the booking and `POST /v1/pickups/:id/cancel` cancels it before the window starts. USPS and DHL Express pickups are free; UPS charges $7.50 and FedEx $5.00 per pickup.
- `pickup.scheduled` and `pickup.cancelled` webhook events.

## [1.3.0] - 2026-10-14

### Added

- Returns accept `"resolution": "exchange"`, with an `exchange_sku` per item, so customers can swap a size or colour instead of asking for a refund.

### Changed

- `shipment.exception` webhook events include an `exception_code` (`address_issue`, `customs_hold`, `damaged`, `delivery_attempt_failed` or `weather_delay`), so integrations can react differently to each cause.

### Fixed

- Exchange returns lost the original order number when they synced back to the store.

## [1.2.0] - 2026-09-09

### Added

- `Idempotency-Key` header on every POST endpoint. A retried request replays the first response instead of buying a second label.
- `"label_format": "zpl"` returns 4x6 ZPL labels for thermal printers.

### Changed

- Rate quotes for orders with many line items return faster.

## [1.1.0] - 2026-08-12

### Added

- Trackers include `estimated_delivery`.
- `GET /v1/orders` filters by `status`.

### Fixed

- Tracking events could arrive out of order when a carrier sent two scans in the same second.

## [1.0.0] - 2026-06-30

- First public release: shipments and rates, labels and voids, trackers, returns, orders and webhook endpoints.
