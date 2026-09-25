export default class AppError extends Error {
  constructor(code, message, statusCode, details = []) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
