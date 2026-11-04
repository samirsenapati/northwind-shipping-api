// Wire types: exactly what the API returns. Timestamps are Unix seconds; amounts are decimal strings.

export type Mode = 'test' | 'live';
export type Plan = 'starter' | 'growth' | 'scale';

export interface ApiKey {
  id: string;
  secret: string;
  mode: Mode;
  plan: Plan;
}

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  zip: string;
  /** ISO 3166-1 alpha-2, e.g. "US" */
  country: string;
  email?: string;
  phone?: string;
}

export interface Parcel {
  /** A saved package preset, e.g. "small_box" */
  preset?: string;
  length?: number;
  width?: number;
  height?: number;
  dimension_unit?: 'in' | 'cm';
  weight: number;
  weight_unit: 'lb' | 'oz' | 'kg' | 'g';
}

export interface Rate {
  id: string;
  carrier: string;
  service: string;
  amount: string;
  currency: string;
  delivery_days: number;
}

export type ShipmentStatus = 'rated' | 'purchased' | 'in_transit' | 'delivered' | 'exception' | 'returned' | 'voided';

export interface ShipmentOptions {
  signature?: boolean;
  /** Declared value to insure, e.g. "120.00" */
  insurance_amount?: string;
  label_format?: 'pdf' | 'zpl';
}

export interface Shipment {
  id: string;
  object: 'shipment';
  status: ShipmentStatus;
  order_id: string | null;
  to_address: Address;
  from_address: Address;
  parcels: Parcel[];
  options: ShipmentOptions;
  rates: Rate[];
  label: Label | null;
  mode: Mode;
  created: number;
}

export type LabelStatus = 'purchased' | 'void_requested' | 'voided';

export interface Label {
  id: string;
  object: 'label';
  shipment_id: string;
  status: LabelStatus;
  carrier: string;
  service: string;
  tracking_number: string;
  label_url: string;
  format: 'pdf' | 'zpl';
  amount: string;
  currency: string;
  created: number;
}

export type TrackingStatus =
  | 'label_created'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned_to_sender';

export type ExceptionCode = 'address_issue' | 'customs_hold' | 'damaged' | 'delivery_attempt_failed' | 'weather_delay';

export interface TrackingEvent {
  status: TrackingStatus;
  description: string;
  location: string | null;
  occurred_at: number;
  /** Set on exception events: why the parcel is stuck */
  exception_code?: ExceptionCode;
}

export interface Tracker {
  id: string;
  object: 'tracker';
  shipment_id: string;
  tracking_number: string;
  carrier: string;
  status: TrackingStatus;
  /** YYYY-MM-DD */
  estimated_delivery: string | null;
  events: TrackingEvent[];
}

export type ReturnStatus = 'requested' | 'approved' | 'in_transit' | 'received' | 'inspected' | 'refunded' | 'closed';
export type ReturnResolution = 'refund' | 'store_credit' | 'exchange';

export interface ReturnItem {
  sku: string;
  quantity: number;
  /** Required when the resolution is "exchange": the variant the customer wants instead */
  exchange_sku?: string;
}

export interface Return {
  id: string;
  object: 'return';
  order_id: string;
  status: ReturnStatus;
  reason: string;
  resolution: ReturnResolution;
  items: ReturnItem[];
  label: { carrier: string; tracking_number: string; label_url: string } | null;
  paid_by: 'store' | 'customer';
  created: number;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: string;
  final_sale?: boolean;
}

export interface Order {
  id: string;
  object: 'order';
  store_id: string;
  number: string;
  status: 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
  financial_status: 'pending' | 'paid' | 'partially_refunded' | 'refunded';
  customer_email: string;
  ship_to: Address;
  items: OrderItem[];
  total: string;
  currency: string;
  fulfilled_at: number | null;
  created: number;
}

export const WEBHOOK_EVENT_TYPES = [
  'order.created',
  'shipment.created',
  'label.purchased',
  'tracking.updated',
  'shipment.delivered',
  'shipment.exception',
  'return.requested',
  'return.received',
  'return.refunded',
  'pickup.scheduled',
  'pickup.cancelled',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookEndpoint {
  id: string;
  object: 'webhook_endpoint';
  url: string;
  events: WebhookEventType[];
  status: 'enabled' | 'disabled';
  secret: string;
  created: number;
}

export interface Pickup {
  id: string;
  object: 'pickup';
  status: 'scheduled' | 'cancelled' | 'completed';
  carrier: string;
  /** The carrier's own reference for the booking */
  confirmation: string;
  shipment_ids: string[];
  address: Address;
  /** Unix seconds; the driver arrives between start and end */
  window: { start: number; end: number };
  instructions: string | null;
  fee: { amount: string; currency: string };
  mode: Mode;
  created: number;
}

export interface Event<T = unknown> {
  id: string;
  object: 'event';
  type: WebhookEventType;
  created: number;
  data: T;
}
