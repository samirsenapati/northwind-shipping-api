import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { advanceTestTrackers } from '../src/jobs/trackingSimulator.js';
import { AUTH, SHIPMENT, setup } from './helpers.js';

describe('POST /v1/shipments', () => {
  it('quotes every carrier on the route, cheapest first', async () => {
    const { app } = setup();
    const res = await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ object: 'shipment', status: 'rated', mode: 'test' });
    expect(res.body.id).toMatch(/^shp_/);
    const amounts = res.body.rates.map((rate: { amount: string }) => Number(rate.amount));
    expect(amounts).toEqual([...amounts].sort((a: number, b: number) => a - b));
    expect(new Set(res.body.rates.map((rate: { carrier: string }) => rate.carrier))).toEqual(new Set(['USPS', 'UPS', 'FedEx']));
  });

  it('only offers DHL Express on international routes', async () => {
    const { app } = setup();
    const toLondon = { ...SHIPMENT, to_address: { name: 'Ada Lowe', street1: '10 Fleet Street', city: 'London', zip: 'EC4Y 1AA', country: 'GB' } };
    const res = await request(app).post('/v1/shipments').set(AUTH).send(toLondon);

    expect(res.status).toBe(201);
    expect(res.body.rates.every((rate: { carrier: string }) => rate.carrier === 'DHL Express')).toBe(true);
  });

  it('names the field when an address cannot be verified', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/v1/shipments')
      .set(AUTH)
      .send({ ...SHIPMENT, to_address: { ...SHIPMENT.to_address, zip: '9720' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ type: 'invalid_request', code: 'address_unverified', param: 'to_address.zip' });
  });

  it('reports schema problems with the dotted path of the field', async () => {
    const { app } = setup();
    const res = await request(app).post('/v1/shipments').set(AUTH).send({ ...SHIPMENT, parcels: [{ weight: -1, weight_unit: 'lb' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'parameter_invalid', param: 'parcels.0.weight' });
  });

  it('replays the first response when a POST is retried with the same Idempotency-Key', async () => {
    const { app, ctx } = setup();
    const first = await request(app).post('/v1/shipments').set(AUTH).set('Idempotency-Key', 'order-1042').send(SHIPMENT);
    const retry = await request(app).post('/v1/shipments').set(AUTH).set('Idempotency-Key', 'order-1042').send(SHIPMENT);

    expect(retry.status).toBe(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(ctx.store.shipments.size).toBe(1);
  });

  it('refuses an Idempotency-Key reused with a different body', async () => {
    const { app } = setup();
    await request(app).post('/v1/shipments').set(AUTH).set('Idempotency-Key', 'order-1042').send(SHIPMENT);
    const res = await request(app)
      .post('/v1/shipments')
      .set(AUTH)
      .set('Idempotency-Key', 'order-1042')
      .send({ ...SHIPMENT, options: { signature: true } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('idempotency_key_reused');
  });
});

describe('labels and tracking', () => {
  it('buys a free test label, starts a tracker, and voids the label while it is unscanned', async () => {
    const { app } = setup();
    const shipment = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;

    const label = await request(app).post(`/v1/shipments/${shipment.id}/labels`).set(AUTH).send({ rate_id: shipment.rates[0].id });
    expect(label.status).toBe(201);
    expect(label.body).toMatchObject({ object: 'label', status: 'purchased', amount: '0.00', format: 'pdf', carrier: shipment.rates[0].carrier });

    const tracker = await request(app).get(`/v1/trackers/${label.body.tracking_number}`).set(AUTH);
    expect(tracker.body).toMatchObject({ status: 'label_created', shipment_id: shipment.id });

    const voided = await request(app).post(`/v1/labels/${label.body.id}/void`).set(AUTH).send();
    expect(voided.status).toBe(200);
    expect(voided.body.status).toBe('voided');
  });

  it('will not void a label the carrier has already scanned', async () => {
    let clock = 1_800_000_000;
    const { app, ctx } = setup({ now: () => clock });
    const shipment = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;
    const label = (await request(app).post(`/v1/shipments/${shipment.id}/labels`).set(AUTH).send({ rate_id: shipment.rates[0].id })).body;

    clock += 11 * 60;
    expect(advanceTestTrackers(ctx)).toBe(1);

    const res = await request(app).post(`/v1/labels/${label.id}/void`).set(AUTH).send();
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('label_already_scanned');
  });

  it('rejects a rate from another shipment', async () => {
    const { app } = setup();
    const first = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;
    const second = (await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT)).body;

    const res = await request(app).post(`/v1/shipments/${second.id}/labels`).set(AUTH).send({ rate_id: first.rates[0].id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'rate_not_found', param: 'rate_id' });
  });
});

describe('authentication, limits and pagination', () => {
  it('asks for an API key', async () => {
    const { app } = setup();
    const res = await request(app).get('/v1/shipments');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ type: 'authentication_error', code: 'missing_api_key' });
  });

  it('rejects a key that does not exist', async () => {
    const { app } = setup();
    const res = await request(app).get('/v1/shipments').set({ Authorization: 'Bearer nw_test_doesnotexist123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_api_key');
  });

  it('reports the rate limit on every response', async () => {
    const { app } = setup();
    const res = await request(app).get('/v1/orders').set(AUTH);

    expect(res.headers['x-ratelimit-limit']).toBe('600');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThan(600);
  });

  it('pages newest first with limit and starting_after', async () => {
    let clock = 1_800_000_000;
    const { app } = setup({ now: () => clock++ });
    for (let i = 0; i < 3; i++) await request(app).post('/v1/shipments').set(AUTH).send(SHIPMENT);

    const page1 = await request(app).get('/v1/shipments?limit=2').set(AUTH);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.has_more).toBe(true);

    const page2 = await request(app).get(`/v1/shipments?limit=2&starting_after=${page1.body.data[1].id}`).set(AUTH);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.has_more).toBe(false);
  });
});
