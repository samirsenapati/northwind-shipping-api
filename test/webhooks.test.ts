import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { advanceTestTrackers } from '../src/jobs/trackingSimulator.js';
import { signPayload, verifySignature } from '../src/services/webhooks.js';
import { AUTH, SHIPMENT, setup } from './helpers.js';

describe('Northwind-Signature', () => {
  const secret = 'whsec_test_secret';
  const body = '{"id":"evt_2Lq9Wx7Hn4","type":"tracking.updated"}';
  const t = 1_800_000_000;

  it('verifies a signature over the timestamp and raw body', () => {
    expect(verifySignature(secret, signPayload(secret, t, body), body, t)).toBe(true);
  });

  it('fails when the body was changed in transit', () => {
    expect(verifySignature(secret, signPayload(secret, t, body), body.replace('tracking', 'shipment'), t)).toBe(false);
  });

  it('fails for a signature older than five minutes, so old events cannot be replayed', () => {
    expect(verifySignature(secret, signPayload(secret, t, body), body, t + 301)).toBe(false);
  });

  it('fails for the wrong secret', () => {
    expect(verifySignature('whsec_other', signPayload(secret, t, body), body, t)).toBe(false);
  });
});

describe('event delivery', () => {
  it('sends only subscribed events, signed with the endpoint secret', async () => {
    const { app, ctx, sent } = setup();
    const endpoint = (
      await request(app)
        .post('/v1/webhook_endpoints')
        .set(AUTH)
        .send({ url: 'https://shop.example/northwind/webhooks', events: ['label.purchased'] })
    ).body;
    expect(endpoint.secret).toMatch(/^whsec_/);

    const shipment = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;
    await request(app).post(`/v1/shipments/${shipment.id}/labels`).set(AUTH).send({ rate_id: shipment.rates[0].id });
    await ctx.webhooks.idle();

    expect(sent).toHaveLength(1);
    const [delivery] = sent;
    expect(delivery.url).toBe('https://shop.example/northwind/webhooks');
    expect(JSON.parse(delivery.body)).toMatchObject({ object: 'event', type: 'label.purchased' });
    expect(verifySignature(endpoint.secret, delivery.headers['Northwind-Signature'], delivery.body)).toBe(true);
  });

  it('follows a test parcel to delivery with tracking.updated and shipment.delivered', async () => {
    let clock = Math.floor(Date.now() / 1000);
    const { app, ctx, sent } = setup({ now: () => clock });
    await request(app)
      .post('/v1/webhook_endpoints')
      .set(AUTH)
      .send({ url: 'https://shop.example/hooks', events: ['tracking.updated', 'shipment.delivered'] });
    const shipment = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;
    await request(app).post(`/v1/shipments/${shipment.id}/labels`).set(AUTH).send({ rate_id: shipment.rates[0].id });

    for (let step = 0; step < 3; step++) {
      clock += 10 * 60;
      advanceTestTrackers(ctx);
    }
    await ctx.webhooks.idle();

    const types = sent.map(delivery => JSON.parse(delivery.body).type);
    expect(types).toEqual(['tracking.updated', 'tracking.updated', 'tracking.updated', 'shipment.delivered']);
    expect(ctx.store.shipments.get(shipment.id)?.status).toBe('delivered');
  });

  it('lists endpoints without revealing their full secret', async () => {
    const { app } = setup();
    const created = (await request(app).post('/v1/webhook_endpoints').set(AUTH).send({ url: 'https://shop.example/hooks', events: ['order.created'] })).body;
    const list = await request(app).get('/v1/webhook_endpoints').set(AUTH);

    expect(list.body.data[0].id).toBe(created.id);
    expect(list.body.data[0].secret).not.toBe(created.secret);
    expect(list.body.data[0].secret.endsWith(created.secret.slice(-4))).toBe(true);
  });
});
