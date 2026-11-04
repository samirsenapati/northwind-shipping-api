// The single error shape the API returns:
//   { "error": { "type": "invalid_request", "code": "address_unverified", "message": "…", "param": "to_address.zip" } }
// A type always maps to the same HTTP status, so clients can branch on either. `code` is the specific
// reason and is stable; `message` is for people and its wording may change.

export type ErrorType =
  | 'invalid_request'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found'
  | 'rate_limited'
  | 'carrier_error'
  | 'api_error';

export const STATUS_FOR: Record<ErrorType, number> = {
  invalid_request: 400,
  authentication_error: 401,
  permission_error: 403,
  not_found: 404,
  rate_limited: 429,
  carrier_error: 502,
  api_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly type: ErrorType,
    readonly code: string,
    message: string,
    readonly param?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS_FOR[this.type];
  }

  toBody() {
    return {
      error: { type: this.type, code: this.code, message: this.message, ...(this.param ? { param: this.param } : {}) },
    };
  }
}

export const invalid = (code: string, message: string, param?: string) =>
  new ApiError('invalid_request', code, message, param);

export const notFound = (what: string, id: string, param = 'id') =>
  new ApiError('not_found', 'resource_missing', `No ${what} exists with ID ${id}.`, param);
