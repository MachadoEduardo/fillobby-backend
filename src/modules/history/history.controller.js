import * as historyService from "./history.service.js";

export async function list(req, res, next) {
  try {
    const data = await historyService.listHistory({
      groupId: req.validated.params.groupId,
      userId: req.user._id,
      ...req.validated.query,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
