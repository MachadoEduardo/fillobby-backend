import * as votesService from "./votes.service.js";

export async function create(req, res, next) {
  try {
    const data = await votesService.createVote({
      groupId: req.validated.params.groupId,
      itemId: req.validated.params.itemId,
      userId: req.user._id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await votesService.removeVote({
      groupId: req.validated.params.groupId,
      itemId: req.validated.params.itemId,
      userId: req.user._id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const data = await votesService.listVotes({
      groupId: req.validated.params.groupId,
      itemId: req.validated.params.itemId,
      userId: req.user._id,
      ...req.validated.query,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
