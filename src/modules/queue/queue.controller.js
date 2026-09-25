import * as queueService from "./queue.service.js";

export async function create(req, res, next) {
  try {
    const data = await queueService.createQueueItem({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      gameId: req.body.gameId,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const data = await queueService.listQueueItems({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      ...req.validated.query,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const data = await queueService.getQueueItem({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function transition(req, res, next) {
  try {
    const data = await queueService.transitionQueueItem({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      targetStatus: req.body.status,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function selectParticipants(req, res, next) {
  try {
    const data = await queueService.selectQueueParticipants({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      participantIds: req.body.participantIds,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function adjustParticipants(req, res, next) {
  try {
    const data = await queueService.adjustQueueParticipants({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      ...req.validated.body,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function setSelfEnrollment(req, res, next) {
  try {
    const data = await queueService.setQueueSelfEnrollment({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      enabled: req.validated.body.enabled,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function changeOwnParticipation(req, res, next, join) {
  try {
    const data = await queueService.changeOwnQueueParticipation({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      join,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export function joinParticipants(req, res, next) {
  return changeOwnParticipation(req, res, next, true);
}

export function leaveParticipants(req, res, next) {
  return changeOwnParticipation(req, res, next, false);
}

export async function markReady(req, res, next) {
  try {
    const data = await queueService.setQueueReadiness({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      isReady: true,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function unmarkReady(req, res, next) {
  try {
    const data = await queueService.setQueueReadiness({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
      isReady: false,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await queueService.cancelQueueItem({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      itemId: req.validated.params.itemId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
