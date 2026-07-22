import * as gamesService from "./games.service.js";

export async function create(req, res, next) {
  try {
    const data = await gamesService.createGame({
      userId: req.user._id,
      data: req.body,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const data = await gamesService.listGames(req.validated.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const data = await gamesService.getGame(req.validated.params.gameId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = await gamesService.updateGame({
      gameId: req.validated.params.gameId,
      userId: req.user._id,
      changes: req.body,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await gamesService.deleteGame({
      gameId: req.validated.params.gameId,
      userId: req.user._id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
