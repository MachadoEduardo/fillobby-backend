import AppError from '../shared/errors/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
      return next(new AppError('VALIDATION_ERROR', 'Dados invalidos.', 422, details));
    }

    if (result.data.body !== undefined) req.body = result.data.body;
    return next();
  };
}
