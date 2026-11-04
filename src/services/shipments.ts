import type { AppContext } from '../context.js';
import { notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import type { Mode, Shipment } from '../models/types.js';
import type { CreateShipmentInput } from '../validation/schemas.js';
import { validateAddress } from './addressValidation.js';
import { rateShipment } from './rating.js';

export function createShipment(ctx: AppContext, input: CreateShipmentInput, mode: Mode): Shipment {
  validateAddress(input.to_address, 'to_address');
  validateAddress(input.from_address, 'from_address');
  if (input.order_id && !ctx.store.orders.has(input.order_id)) throw notFound('order', input.order_id, 'order_id');

  const shipment: Shipment = {
    id: newId('shipment'),
    object: 'shipment',
    status: 'rated',
    order_id: input.order_id ?? null,
    to_address: input.to_address,
    from_address: input.from_address,
    parcels: input.parcels,
    options: input.options,
    rates: rateShipment(input.from_address, input.to_address, input.parcels, input.options),
    label: null,
    mode,
    created: ctx.now(),
  };
  ctx.store.shipments.set(shipment.id, shipment);
  ctx.webhooks.emit('shipment.created', shipment);
  return shipment;
}

export function findShipment(ctx: AppContext, id: string, mode: Mode): Shipment {
  const shipment = ctx.store.shipments.get(id);
  // Test keys never see live objects and the reverse, so test traffic cannot touch real labels.
  if (!shipment || shipment.mode !== mode) throw notFound('shipment', id);
  return shipment;
}
