import mongoose from "mongoose";
import AppError from "../shared/errors/AppError.js";

export function notFoundMiddleware(req, res, next) {
  next(new AppError("ROUTE_NOT_FOUND", "Rota nao encontrada.", 404));
}

export function errorMiddleware(error, req, res, next) {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "JSON invalido.", details: [] },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error?.code === 11000) {
    const isEmail = error.keyPattern?.email;
    return res.status(409).json({
      success: false,
      error: {
        code: isEmail ? "EMAIL_ALREADY_EXISTS" : "DUPLICATE_RESOURCE",
        message: isEmail ? "Email ja cadastrado." : "Recurso duplicado.",
        details: [],
      },
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return res.status(422).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Dados invalidos.", details },
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor.", details: [] },
  });
}
