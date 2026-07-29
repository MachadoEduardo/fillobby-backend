import mongoose from "mongoose";
import Game from "../../models/Game.js";
import GroupMember from "../../models/GroupMember.js";
import QueueItem from "../../models/QueueItem.js";
import AppError from "../../shared/errors/AppError.js";
import { getActiveGroupContext } from "../groups/groups.service.js";
import {
  ACTIVE_QUEUE_STATUSES,
  ALLOWED_QUEUE_TRANSITIONS,
  PUBLIC_STATUS_TRANSITIONS,
  QUEUE_STATUS,
} from "./queue.constants.js";
import { serializeQueueItem } from "./queue.serializer.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function id(value) {
  return value?.toString();
}

async function populateItem(item) {
  await item.populate([
    { path: "game", select: "title platforms maxPlayers coverUrl isActive" },
    { path: "suggestedBy", select: "name avatarUrl" },
    { path: "participants", select: "name avatarUrl" },
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

function participantsNotEditableError() {
  return new AppError(
    "QUEUE_PARTICIPANTS_NOT_EDITABLE",
    "Os participantes nao podem ser alterados no estado atual.",
    409,
  );
}

function readinessNotEditableError() {
  return new AppError(
    "QUEUE_READINESS_NOT_EDITABLE",
    "A prontidao nao pode ser alterada no estado atual.",
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
      .populate("participants", "name avatarUrl")
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

export async function selectQueueParticipants({
  groupId,
  userId,
  itemId,
  participantIds,
}) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireAdmin(membership);
  const item = await findQueueItem(group._id, itemId, false);
  const editableStatuses = [QUEUE_STATUS.VOTING, QUEUE_STATUS.WAITING_PLAYERS];

  if (!editableStatuses.includes(item.status)) {
    throw participantsNotEditableError();
  }

  const game = await Game.findById(item.game).select("maxPlayers");
  if (
    game?.maxPlayers !== null &&
    game?.maxPlayers !== undefined &&
    participantIds.length > game.maxPlayers
  ) {
    throw new AppError(
      "MAX_PLAYERS_EXCEEDED",
      `Este jogo permite no maximo ${game.maxPlayers} participantes.`,
      422,
    );
  }

  const activeMembers = await GroupMember.countDocuments({
    group: group._id,
    user: { $in: participantIds },
    status: "ACTIVE",
  });
  if (activeMembers !== participantIds.length) {
    throw new AppError(
      "INVALID_QUEUE_PARTICIPANTS",
      "Todos os participantes devem ser membros ativos do grupo.",
      422,
    );
  }

  const participantObjectIds = participantIds.map(
    (participantId) => new mongoose.Types.ObjectId(participantId),
  );
  const updatedItem = await QueueItem.findOneAndUpdate(
    {
      _id: item._id,
      group: group._id,
      status: { $in: editableStatuses },
    },
    [
      {
        $set: {
          participants: participantObjectIds,
          readyUsers: {
            $cond: [
              { $eq: ["$status", QUEUE_STATUS.VOTING] },
              [],
              { $setIntersection: ["$readyUsers", participantObjectIds] },
            ],
          },
        },
      },
      {
        $set: {
          status: {
            $cond: [
              { $setEquals: ["$participants", "$readyUsers"] },
              QUEUE_STATUS.READY,
              QUEUE_STATUS.WAITING_PLAYERS,
            ],
          },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );

  if (!updatedItem) throw participantsNotEditableError();
  return serializeQueueItem(await populateItem(updatedItem));
}

export async function setQueueReadiness({ groupId, userId, itemId, isReady }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const item = await findQueueItem(group._id, itemId, false);
  const readinessStatuses = [QUEUE_STATUS.WAITING_PLAYERS, QUEUE_STATUS.READY];

  if (!readinessStatuses.includes(item.status)) {
    throw readinessNotEditableError();
  }
  if (
    !item.participants.some((participantId) => id(participantId) === id(userId))
  ) {
    throw new AppError(
      "NOT_QUEUE_PARTICIPANT",
      "Somente participantes podem alterar a propria prontidao.",
      403,
    );
  }

  const userObjectId = new mongoose.Types.ObjectId(id(userId));
  const readinessUpdate = isReady
    ? { $setUnion: ["$readyUsers", [userObjectId]] }
    : { $setDifference: ["$readyUsers", [userObjectId]] };
  const updatedItem = await QueueItem.findOneAndUpdate(
    {
      _id: item._id,
      group: group._id,
      status: { $in: readinessStatuses },
      participants: userObjectId,
    },
    [
      { $set: { readyUsers: readinessUpdate } },
      {
        $set: {
          status: isReady
            ? {
                $cond: [
                  {
                    $and: [
                      { $gt: [{ $size: "$participants" }, 0] },
                      { $setEquals: ["$participants", "$readyUsers"] },
                    ],
                  },
                  QUEUE_STATUS.READY,
                  QUEUE_STATUS.WAITING_PLAYERS,
                ],
              }
            : QUEUE_STATUS.WAITING_PLAYERS,
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );

  if (!updatedItem) {
    const currentItem = await findQueueItem(group._id, itemId, false);
    if (!readinessStatuses.includes(currentItem.status)) {
      throw readinessNotEditableError();
    }
    throw new AppError(
      "NOT_QUEUE_PARTICIPANT",
      "Somente participantes podem alterar a propria prontidao.",
      403,
    );
  }

  return serializeQueueItem(await populateItem(updatedItem));
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
