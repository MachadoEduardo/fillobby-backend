import * as authService from "./auth.service.js";

export async function register(req, res, next) {
  try {
    return res.status(201).json({ success: true, data: await authService.register(req.body) });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    return res.status(200).json({ success: true, data: await authService.login(req.body) });
  } catch (error) {
    return next(error);
  }
}

export function me(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: authService.serializeUser(req.user) },
  });
}
