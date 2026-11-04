import { randomInt } from 'node:crypto';

// Every object ID starts with a prefix that says what it is, so a stray ID in a log is easy to place.
export const ID_PREFIX = {
  shipment: 'shp',
  rate: 'rate',
  label: 'lbl',
  tracker: 'trk',
  return: 'ret',
  order: 'ord',
  webhookEndpoint: 'we',
  event: 'evt',
  pickup: 'pku',
} as const;

export type ObjectKind = keyof typeof ID_PREFIX;

// No 0/O or 1/I/l: IDs get read aloud on support calls.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

export function newId(kind: ObjectKind, length = 10): string {
  let body = '';
  for (let i = 0; i < length; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  return `${ID_PREFIX[kind]}_${body}`;
}
