import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AUTH, setup } from './helpers.js';

// Seeded orders: #1042 shipped 6 days ago, #1044 has a final-sale item, #1038 shipped 41 days ago,
// #1045 has not shipped.
describe('POST /v1/returns', () => {
  it('approves a return inside the window and includes a prepaid label', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({ order_id: 'ord_7Hk3Pz9Rm2', reason: 'Arrived chipped', items: [{ sku: 'JG-MUG-12OZ', quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ object: 'return', status: 'approved', resolution: 'refund', paid_by: 'store' });
    expect(res.body.label.carrier).toBe('USPS');
  });

  it('accepts an exchange for another variant', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({
        order_id: 'ord_5Rf7Hy3Ns8',
        reason: 'Too large',
        resolution: 'exchange',
        items: [{ sku: 'JG-THROW-OAT-L', quantity: 1, exchange_sku: 'JG-THROW-OAT-M' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.items[0].exchange_sku).toBe('JG-THROW-OAT-M');
  });

  it('closes returns 30 days after fulfilment', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({ order_id: 'ord_9Tn2Lm6Kd4', reason: 'Changed my mind', items: [{ sku: 'JG-BOWL-SET', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'return_window_closed', param: 'order_id' });
  });

  it('refuses final-sale items', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({ order_id: 'ord_5Rf7Hy3Ns8', reason: 'Wrong scent', items: [{ sku: 'JG-CANDLE-CLEAR', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'item_final_sale', param: 'items.0.sku' });
  });

  it('needs an exchange SKU for an exchange', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({ order_id: 'ord_7Hk3Pz9Rm2', reason: 'Wrong colour', resolution: 'exchange', items: [{ sku: 'JG-MUG-12OZ', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('exchange_sku_required');
  });

  it('has nothing to return on an order that has not shipped', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/returns')
      .set(AUTH)
      .send({ order_id: 'ord_3Qw8Xc5Vb7', reason: 'Ordered twice', items: [{ sku: 'JG-MUG-12OZ', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('order_not_fulfilled');
  });
});
