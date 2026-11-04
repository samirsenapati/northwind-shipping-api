import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AUTH, SHIPMENT, setup } from './helpers.js';

const HOUR = 60 * 60;

async function labelledShipment(app: Parameters<typeof request>[0], carrier = 'USPS') {
  const shipment = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;
  const rate = shipment.rates.find((r: { carrier: string }) => r.carrier === carrier);
  await request(app).post(`/v1/shipments/${shipment.id}/labels`).set(AUTH).send({ rate_id: rate.id });
  return shipment.id as string;
}

describe('POST /v1/pickups', () => {
  it('books a pickup for labelled shipments at their sender address', async () => {
    const clock = 1_800_000_000;
    const { app } = setup({ now: () => clock });
    const ids = [await labelledShipment(app), await labelledShipment(app)];

    const res = await request(app)
      .post('/v1/pickups')
      .set(AUTH)
      .send({ shipment_ids: ids, pickup_window: { start: clock + 3 * HOUR, end: clock + 6 * HOUR }, instructions: 'Side door, ring twice' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ object: 'pickup', status: 'scheduled', carrier: 'USPS', shipment_ids: ids, fee: { amount: '0.00' } });
    expect(res.body.id).toMatch(/^pku_/);
    expect(res.body.confirmation).toMatch(/^WTC\d{9}$/);
    expect(res.body.address.street1).toBe(SHIPMENT.from_address.street1);
  });

  it('needs at least 2 hours of notice', async () => {
    const clock = 1_800_000_000;
    const { app } = setup({ now: () => clock });
    const id = await labelledShipment(app);

    const res = await request(app)
      .post('/v1/pickups')
      .set(AUTH)
      .send({ shipment_ids: [id], pickup_window: { start: clock + HOUR, end: clock + 4 * HOUR } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'pickup_window_too_soon', param: 'pickup_window.start' });
  });

  it('books one carrier per pickup', async () => {
    const clock = 1_800_000_000;
    const { app } = setup({ now: () => clock });
    const ids = [await labelledShipment(app, 'USPS'), await labelledShipment(app, 'UPS')];

    const res = await request(app)
      .post('/v1/pickups')
      .set(AUTH)
      .send({ shipment_ids: ids, pickup_window: { start: clock + 3 * HOUR, end: clock + 6 * HOUR } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'mixed_carriers', param: 'shipment_ids.1' });
  });

  it('only collects shipments that have a label', async () => {
    const clock = 1_800_000_000;
    const { app } = setup({ now: () => clock });
    const unlabelled = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;

    const res = await request(app)
      .post('/v1/pickups')
      .set(AUTH)
      .send({ shipment_ids: [unlabelled.id], pickup_window: { start: clock + 3 * HOUR, end: clock + 6 * HOUR } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('shipment_not_ready');
  });

  it('cancels before the window starts, and only once', async () => {
    const clock = 1_800_000_000;
    const { app } = setup({ now: () => clock });
    const id = await labelledShipment(app);
    const pickup = (
      await request(app)
        .post('/v1/pickups')
        .set(AUTH)
        .send({ shipment_ids: [id], pickup_window: { start: clock + 3 * HOUR, end: clock + 6 * HOUR } })
    ).body;

    const cancelled = await request(app).post(`/v1/pickups/${pickup.id}/cancel`).set(AUTH).send();
    expect(cancelled.body.status).toBe('cancelled');

    const again = await request(app).post(`/v1/pickups/${pickup.id}/cancel`).set(AUTH).send();
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('pickup_not_cancellable');
  });
});
