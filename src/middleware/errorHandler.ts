import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, invalid } from '../lib/errors.js';

export const notFoundRoute: RequestHandler = (req, _res, next) => {
  next(new ApiError('not_found', 'route_missing', `No endpoint matches ${req.method} ${req.path}.`));
};

// Turns anything thrown by a route into the standard error body. Unknown errors are logged and reported
// as a generic api_error, so internals never leak into responses.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let error: ApiError;
  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof ZodError) {
    const issue = err.issues[0];
    const param = issue.path.join('.');
    error = invalid('parameter_invalid', param ? `${param}: ${issue.message}` : issue.message, param || undefined);
  } else if (err?.type === 'entity.parse.failed') {
    error = invalid('invalid_json', 'The request body is not valid JSON.');
  } else {
    console.error(err);
    error = new ApiError('api_error', 'internal_error', 'Something went wrong on our side. Retry with the same Idempotency-Key.');
  }
  res.status(error.status).json(error.toBody());
};
