import Vote from "../../models/Vote.js";

export async function findViewerVoteItemIds(queueItems, userId) {
  if (!queueItems.length) return new Set();

  const queueItemIds = queueItems.map((item) => item._id);
  const votedItemIds = await Vote.find({
    queueItem: { $in: queueItemIds },
    user: userId,
  }).distinct("queueItem");

  return new Set(votedItemIds.map(String));
}
