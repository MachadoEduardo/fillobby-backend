import mongoose from "mongoose";
import QueueItem from "../../models/QueueItem.js";
import Vote from "../../models/Vote.js";
import VotingRound from "../../models/VotingRound.js";
import AppError from "../../shared/errors/AppError.js";
import { getActiveGroupContext } from "../groups/groups.service.js";
import { QUEUE_STATUS } from "../queue/queue.constants.js";

function requireAdmin(membership) {
  if (!["OWNER", "ADMIN"].includes(membership.role))
    throw new AppError(
      "INSUFFICIENT_GROUP_ROLE",
      "Voce nao possui permissao para esta operacao.",
      403,
    );
}

async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function serializeRound(round) {
  await round.populate([
    { path: "startedBy", select: "name avatarUrl" },
    { path: "closedBy", select: "name avatarUrl" },
  ]);
  const liveItems =
    round.status === "OPEN"
      ? await QueueItem.find({
          _id: { $in: round.candidates.map((candidate) => candidate.item) },
        }).select("voteCount")
      : [];
  const counts = new Map(liveItems.map((item) => [item.id, item.voteCount]));
  return {
    id: round.id,
    groupId: round.group.toString(),
    status: round.status,
    candidates: round.candidates.map((candidate) => ({
      itemId: candidate.item.toString(),
      gameTitle: candidate.gameTitle,
      voteCount: counts.get(candidate.item.toString()) ?? candidate.voteCount,
    })),
    startedBy: {
      id: round.startedBy.id,
      name: round.startedBy.name,
      avatarUrl: round.startedBy.avatarUrl ?? null,
    },
    startedAt: round.createdAt,
    closedBy: round.closedBy
      ? {
          id: round.closedBy.id,
          name: round.closedBy.name,
          avatarUrl: round.closedBy.avatarUrl ?? null,
        }
      : null,
    closedAt: round.closedAt,
    winnerItemId: round.winnerItem?.toString() ?? null,
  };
}

export async function listRounds({ groupId, userId, page, limit }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const filter = { group: group._id };
  const [total, rounds] = await Promise.all([
    VotingRound.countDocuments(filter),
    VotingRound.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);
  return {
    rounds: await Promise.all(rounds.map(serializeRound)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function startRound({ groupId, userId, candidateIds }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireAdmin(membership);
  let round;
  try {
    round = await transaction(async (session) => {
      if (await VotingRound.exists({ group: group._id, status: "OPEN" }).session(session))
        throw new AppError("VOTING_ROUND_ALREADY_OPEN", "Ja existe uma votacao aberta.", 409);
      if (
        await QueueItem.exists({
          group: group._id,
          status: QUEUE_STATUS.VOTING,
          votingRound: null,
        }).session(session)
      )
        throw new AppError(
          "LEGACY_VOTING_PENDING",
          "Encerre as votacoes antigas antes de iniciar uma rodada.",
          409,
        );

      const items = await QueueItem.find({
        _id: { $in: candidateIds },
        group: group._id,
        status: QUEUE_STATUS.SUGGESTED,
      })
        .populate("game", "title")
        .session(session);
      if (items.length !== candidateIds.length)
        throw new AppError(
          "INVALID_ROUND_CANDIDATES",
          "Escolha apenas sugestoes disponiveis deste grupo.",
          409,
        );
      const byId = new Map(items.map((item) => [item.id, item]));
      const [created] = await VotingRound.create(
        [
          {
            group: group._id,
            startedBy: userId,
            candidates: candidateIds.map((itemId) => ({
              item: itemId,
              gameTitle: byId.get(itemId).game.title,
            })),
          },
        ],
        { session },
      );
      const updated = await QueueItem.updateMany(
        { _id: { $in: candidateIds }, group: group._id, status: QUEUE_STATUS.SUGGESTED },
        { $set: { status: QUEUE_STATUS.VOTING, votingRound: created._id } },
        { session },
      );
      if (updated.modifiedCount !== candidateIds.length)
        throw new AppError(
          "INVALID_ROUND_CANDIDATES",
          "As sugestoes mudaram. Atualize a fila.",
          409,
        );
      return created;
    });
  } catch (error) {
    if (error?.code === 11000)
      throw new AppError("VOTING_ROUND_ALREADY_OPEN", "Ja existe uma votacao aberta.", 409);
    throw error;
  }
  return serializeRound(round);
}

async function finishRound({ groupId, userId, roundId, winnerItemId, cancel }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireAdmin(membership);
  const round = await transaction(async (session) => {
    const current = await VotingRound.findOne({
      _id: roundId,
      group: group._id,
      status: "OPEN",
    }).session(session);
    if (!current) throw new AppError("VOTING_ROUND_NOT_OPEN", "Votacao nao esta aberta.", 409);
    const ids = current.candidates.map((candidate) => candidate.item);
    const items = await QueueItem.find({
      _id: { $in: ids },
      group: group._id,
      status: QUEUE_STATUS.VOTING,
      votingRound: current._id,
    }).session(session);
    if (items.length !== ids.length)
      throw new AppError("VOTING_ROUND_CHANGED", "A votacao mudou. Atualize a pagina.", 409);
    const counts = new Map(items.map((item) => [item.id, item.voteCount]));
    current.candidates.forEach((candidate) => {
      candidate.voteCount = counts.get(candidate.item.toString());
    });

    let winnerId = null;
    if (!cancel) {
      const max = Math.max(...current.candidates.map((candidate) => candidate.voteCount));
      if (max === 0)
        throw new AppError("VOTING_ROUND_NO_VOTES", "Cancele a rodada sem votos.", 409);
      const leaders = current.candidates
        .filter((candidate) => candidate.voteCount === max)
        .map((candidate) => candidate.item.toString());
      if (leaders.length > 1 && !leaders.includes(winnerItemId))
        throw new AppError("VOTING_ROUND_TIE", "Escolha um dos jogos empatados.", 422);
      if (leaders.length === 1 && winnerItemId)
        throw new AppError("VOTING_ROUND_NOT_TIED", "O jogo mais votado ja venceu.", 422);
      winnerId = leaders.length === 1 ? leaders[0] : winnerItemId;
    }

    const resetIds = ids.filter((itemId) => itemId.toString() !== winnerId);
    if (resetIds.length) {
      await Vote.deleteMany({ queueItem: { $in: resetIds } }).session(session);
      await QueueItem.updateMany(
        {
          _id: { $in: resetIds },
          group: group._id,
          status: QUEUE_STATUS.VOTING,
          votingRound: current._id,
        },
        { $set: { status: QUEUE_STATUS.SUGGESTED, voteCount: 0 } },
        { session },
      );
    }
    if (winnerId) {
      const winner = await QueueItem.updateOne(
        { _id: winnerId, group: group._id, status: QUEUE_STATUS.VOTING, votingRound: current._id },
        { $set: { status: QUEUE_STATUS.WAITING_PLAYERS } },
        { session },
      );
      if (winner.modifiedCount !== 1)
        throw new AppError("VOTING_ROUND_CHANGED", "A votacao mudou. Atualize a pagina.", 409);
    }
    current.status = cancel ? "CANCELLED" : "CLOSED";
    current.winnerItem = winnerId;
    current.closedBy = userId;
    current.closedAt = new Date();
    await current.save({ session });
    return current;
  });
  return serializeRound(round);
}

export function closeRound(input) {
  return finishRound({ ...input, cancel: false });
}
export function cancelRound(input) {
  return finishRound({ ...input, cancel: true });
}
