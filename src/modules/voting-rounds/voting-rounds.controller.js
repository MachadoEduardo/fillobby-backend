import * as service from "./voting-rounds.service.js";

export async function list(req, res, next) {
  try {
    const data = await service.listRounds({
      ...req.validated.params,
      ...req.validated.query,
      userId: req.user._id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function start(req, res, next) {
  try {
    const data = await service.startRound({
      ...req.validated.params,
      ...req.body,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function close(req, res, next) {
  try {
    const data = await service.closeRound({
      ...req.validated.params,
      ...req.body,
      userId: req.user._id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const data = await service.cancelRound({ ...req.validated.params, userId: req.user._id });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
