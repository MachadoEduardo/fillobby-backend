import QueueItem from "../../models/QueueItem.js";
import { getActiveGroupContext } from "../groups/groups.service.js";
import { QUEUE_STATUS } from "../queue/queue.constants.js";

function id(value) {
  return value?.toString();
}

function serializeHistoryItem(item) {
  const game = item.game;
  const suggestedBy = item.suggestedBy;
  return {
    id: id(item._id),
    groupId: id(item.group),
    game: {
      id: id(game?._id ?? game),
      title: game?.title,
      platforms: game?.platforms,
      maxPlayers: game?.maxPlayers ?? null,
      coverUrl: game?.coverUrl ?? null,
    },
    suggestedBy: {
      id: id(suggestedBy?._id ?? suggestedBy),
      name: suggestedBy?.name,
      avatarUrl: suggestedBy?.avatarUrl ?? null,
    },
    status: item.status,
    voteCount: item.voteCount,
    participantIds: item.participants.map(id),
    readyUserIds: item.readyUsers.map(id),
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function startOfUtcDay(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfUtcDay(value) {
  return new Date(`${value}T23:59:59.999Z`);
}

export async function listHistory({
  groupId,
  userId,
  from,
  to,
  gameId,
  participantId,
  page,
  limit,
}) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const filter = {
    group: group._id,
    status: QUEUE_STATUS.COMPLETED,
  };

  if (gameId) filter.game = gameId;
  if (participantId) filter.participants = participantId;
  if (from || to) {
    filter.completedAt = {};
    if (from) filter.completedAt.$gte = startOfUtcDay(from);
    if (to) filter.completedAt.$lte = endOfUtcDay(to);
  }

  const [total, items] = await Promise.all([
    QueueItem.countDocuments(filter),
    QueueItem.find(filter)
      .populate("game", "title platforms maxPlayers coverUrl")
      .populate("suggestedBy", "name avatarUrl")
      .sort({ completedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    historyItems: items.map(serializeHistoryItem),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
