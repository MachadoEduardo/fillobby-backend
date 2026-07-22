import Game from "../../models/Game.js";
import QueueItem from "../../models/QueueItem.js";
import AppError from "../../shared/errors/AppError.js";
import { getActiveGroupContext } from "../groups/groups.service.js";
import {
  ACTIVE_QUEUE_STATUSES,
  ALLOWED_QUEUE_TRANSITIONS,
  PUBLIC_STATUS_TRANSITIONS,
  QUEUE_STATUS,
} from "./queue.constants.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function id(value) {
  return value?.toString();
}

function serializeQueueItem(item) {
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

async function populateItem(item) {
  await item.populate([
    { path: "game", select: "title platforms maxPlayers coverUrl isActive" },
    { path: "suggestedBy", select: "name avatarUrl" },
  ]);
  return item;
}

function requireAdmin(membership) {
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    throw new AppError(
      "INSUFFICIENT_GROUP_ROLE",
      "Voce nao possui permissao para esta operacao.",
      403,
    );
  }
}

function duplicateQueueItemError() {
  return new AppError(
    "QUEUE_ITEM_ALREADY_EXISTS",
    "Este jogo ja possui um item ativo na fila.",
    409,
  );
}

async function findQueueItem(groupId, itemId, activeOnly = true) {
  const filter = { _id: itemId, group: groupId };
  if (activeOnly) filter.status = { $in: ACTIVE_QUEUE_STATUSES };
  const item = await QueueItem.findOne(filter);
  if (!item)
    throw new AppError(
      "QUEUE_ITEM_NOT_FOUND",
      "Item da fila nao encontrado.",
      404,
    );
  return item;
}

export async function createQueueItem({ groupId, userId, gameId }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const game = await Game.findOne({ _id: gameId, isActive: true });
  if (!game) throw new AppError("GAME_NOT_FOUND", "Jogo nao encontrado.", 404);
  if (
    await QueueItem.exists({
      group: group._id,
      game: game._id,
      status: { $in: ACTIVE_QUEUE_STATUSES },
    })
  )
    throw duplicateQueueItemError();

  try {
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: userId,
      status: QUEUE_STATUS.SUGGESTED,
    });
    return serializeQueueItem(await populateItem(item));
  } catch (error) {
    if (error?.code === 11000) throw duplicateQueueItemError();
    throw error;
  }
}

export async function listQueueItems({
  groupId,
  userId,
  status,
  search,
  platform,
  page,
  limit,
  sort,
}) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const filter = {
    group: group._id,
    status: { $in: status ?? ACTIVE_QUEUE_STATUSES },
  };

  if (search || platform) {
    const gameFilter = {};
    if (search)
      gameFilter.title = { $regex: escapeRegex(search), $options: "i" };
    if (platform) gameFilter.platforms = platform;
    const gameIds = await Game.find(gameFilter).distinct("_id");
    filter.game = { $in: gameIds };
  }

  const sortOptions = {
    votes_desc: { voteCount: -1, createdAt: 1, _id: 1 },
    created_asc: { createdAt: 1, _id: 1 },
    updated_desc: { updatedAt: -1, _id: 1 },
  };
  const [total, items] = await Promise.all([
    QueueItem.countDocuments(filter),
    QueueItem.find(filter)
      .populate("game", "title platforms maxPlayers coverUrl isActive")
      .populate("suggestedBy", "name avatarUrl")
      .sort(sortOptions[sort])
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    queueItems: items.map(serializeQueueItem),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getQueueItem({ groupId, userId, itemId }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  return serializeQueueItem(
    await populateItem(await findQueueItem(group._id, itemId)),
  );
}

export async function transitionQueueItem({
  groupId,
  userId,
  itemId,
  targetStatus,
}) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireAdmin(membership);
  const item = await findQueueItem(group._id, itemId, false);
  if ([QUEUE_STATUS.COMPLETED, QUEUE_STATUS.CANCELLED].includes(item.status))
    throw new AppError(
      "QUEUE_ITEM_IMMUTABLE",
      "Este item da fila e somente leitura.",
      409,
    );

  const isDomainTransition =
    ALLOWED_QUEUE_TRANSITIONS[item.status]?.includes(targetStatus);
  const isPublicTransition =
    PUBLIC_STATUS_TRANSITIONS[item.status]?.includes(targetStatus);
  if (!isDomainTransition || !isPublicTransition)
    throw new AppError(
      "INVALID_QUEUE_TRANSITION",
      `Transicao de ${item.status} para ${targetStatus} nao permitida.`,
      400,
    );

  item.status = targetStatus;
  item.completedAt =
    targetStatus === QUEUE_STATUS.COMPLETED ? new Date() : null;
  await item.save();
  return serializeQueueItem(await populateItem(item));
}

export async function cancelQueueItem({ groupId, userId, itemId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireAdmin(membership);
  const item = await findQueueItem(group._id, itemId, false);
  if (!ALLOWED_QUEUE_TRANSITIONS[item.status]?.includes(QUEUE_STATUS.CANCELLED))
    throw new AppError(
      "QUEUE_ITEM_IMMUTABLE",
      "Este item da fila e somente leitura.",
      409,
    );
  item.status = QUEUE_STATUS.CANCELLED;
  item.completedAt = null;
  await item.save();
  return serializeQueueItem(await populateItem(item));
}
