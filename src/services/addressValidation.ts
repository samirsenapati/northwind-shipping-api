import { invalid } from '../lib/errors.js';
import type { Address } from '../models/types.js';

// Carriers do the final address check when a label is bought. This catches the mistakes that would make
// every carrier reject the shipment, early, and names the exact field so the error says what to fix.

const US_ZIP = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_CODE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/;
const PO_BOX = /\bP\.?\s*O\.?\s*Box\b/i;

const US_STATES = new Set(
  ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR ' +
    'PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP AA AE AP').split(' '),
);

export function validateAddress(address: Address, field: 'to_address' | 'from_address'): void {
  const fail = (param: string, hint: string) => {
    const which = field === 'to_address' ? 'destination' : 'sender';
    return invalid('address_unverified', `The ${which} address could not be verified. ${hint}`, `${field}.${param}`);
  };

  switch (address.country) {
    case 'US':
      if (!US_ZIP.test(address.zip)) throw fail('zip', 'US ZIP codes have 5 digits, or 5+4 like 97205-1234.');
      if (!address.state || !US_STATES.has(address.state.toUpperCase())) {
        throw fail('state', 'Use the two-letter state code, such as OR.');
      }
      break;
    case 'CA':
      if (!CA_POSTAL_CODE.test(address.zip)) throw fail('zip', 'Canadian postal codes look like K1A 0B1.');
      break;
    case 'GB':
      if (!UK_POSTCODE.test(address.zip)) throw fail('zip', 'UK postcodes look like SW1A 1AA.');
      break;
  }

  // Carriers deliver to PO boxes (USPS only) but never collect from one.
  if (field === 'from_address' && PO_BOX.test(address.street1)) {
    throw fail('street1', 'Carriers cannot collect from a PO box; use a street address for the sender.');
  }
}
