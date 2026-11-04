import { config, DAY_SECONDS } from '../config.js';
import type { AppContext } from '../context.js';
import { invalid, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import type { Return } from '../models/types.js';
import type { CreateReturnInput } from '../validation/schemas.js';
import { usps } from './carriers/index.js';

// Starts a return against a shipped order. The default policy: a 30-day window from fulfilment,
// final-sale items excluded, the store pays for the return label, and returns are approved at once.
export function createReturn(ctx: AppContext, input: CreateReturnInput): Return {
  const order = ctx.store.orders.get(input.order_id);
  if (!order) throw notFound('order', input.order_id, 'order_id');

  if (order.fulfilled_at === null || order.status === 'unfulfilled' || order.status === 'cancelled') {
    throw invalid('order_not_fulfilled', `Order ${order.number} has not shipped, so there is nothing to return yet.`, 'order_id');
  }
  const daysSinceFulfilment = Math.floor((ctx.now() - order.fulfilled_at) / DAY_SECONDS);
  if (daysSinceFulfilment > config.returnWindowDays) {
    throw invalid(
      'return_window_closed',
      `Order ${order.number} shipped ${daysSinceFulfilment} days ago; returns close ${config.returnWindowDays} days after fulfilment.`,
      'order_id',
    );
  }

  input.items.forEach((item, i) => {
    const line = order.items.find(orderItem => orderItem.sku === item.sku);
    if (!line) throw invalid('item_not_in_order', `SKU ${item.sku} is not on order ${order.number}.`, `items.${i}.sku`);
    if (line.final_sale) throw invalid('item_final_sale', `${line.name} was sold as final sale and cannot be returned.`, `items.${i}.sku`);
    if (item.quantity > line.quantity) {
      throw invalid('quantity_exceeds_order', `Order ${order.number} has ${line.quantity} of ${item.sku}.`, `items.${i}.quantity`);
    }
    if (input.resolution === 'exchange' && !item.exchange_sku) {
      throw invalid('exchange_sku_required', 'Exchanges need the exchange_sku the customer wants instead.', `items.${i}.exchange_sku`);
    }
  });

  const label = usps.purchase('Ground Advantage', 'pdf');
  const created: Return = {
    id: newId('return'),
    object: 'return',
    order_id: order.id,
    status: 'approved',
    reason: input.reason,
    resolution: input.resolution,
    items: input.items,
    label: { carrier: usps.name, tracking_number: label.trackingNumber, label_url: label.labelUrl },
    paid_by: 'store',
    created: ctx.now(),
  };
  ctx.store.returns.set(created.id, created);
  ctx.webhooks.emit('return.requested', created);
  return created;
}
