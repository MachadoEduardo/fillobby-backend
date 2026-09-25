import mongoose from "mongoose";
import QueueItem from "../../models/QueueItem.js";
import Vote from "../../models/Vote.js";
import AppError from "../../shared/errors/AppError.js";
import { getActiveGroupContext } from "../groups/groups.service.js";
import { QUEUE_STATUS } from "../queue/queue.constants.js";

function voteAlreadyExistsError() {
  return new AppError("VOTE_ALREADY_EXISTS", "Voce ja votou neste jogo.", 409);
}

function queueNotVotingError() {
  return new AppError(
    "QUEUE_ITEM_NOT_VOTING",
    "Votos so podem ser alterados durante a votacao.",
    409,
  );
}

async function withTransaction(work) {
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

async function findQueueItem(groupId, itemId) {
  const item = await QueueItem.findOne({ _id: itemId, group: groupId });
  if (!item) throw new AppError("QUEUE_ITEM_NOT_FOUND", "Item da fila nao encontrado.", 404);
  return item;
}

function ensureVoting(item) {
  if (item.status !== QUEUE_STATUS.VOTING) throw queueNotVotingError();
}

function serializeVote(vote) {
  const user = vote.user;
  return {
    id: vote._id.toString(),
    user: {
      id: (user._id ?? user).toString(),
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
    },
    createdAt: vote.createdAt,
  };
}

export async function createVote({ groupId, itemId, userId }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const item = await findQueueItem(group._id, itemId);
  ensureVoting(item);
  if (await Vote.exists({ queueItem: item._id, user: userId })) throw voteAlreadyExistsError();

  let result;
  try {
    result = await withTransaction(async (session) => {
      const updatedItem = await QueueItem.findOneAndUpdate(
        { _id: item._id, group: group._id, status: QUEUE_STATUS.VOTING },
        { $inc: { voteCount: 1 } },
        { new: true, session },
      );
      if (!updatedItem) throw queueNotVotingError();

      const votes = await Vote.create([{ queueItem: item._id, user: userId }], {
        session,
      });
      return { voteId: votes[0]._id, voteCount: updatedItem.voteCount };
    });
  } catch (error) {
    if (error?.code === 11000) throw voteAlreadyExistsError();
    throw error;
  }

  const vote = await Vote.findById(result.voteId).populate("user", "name avatarUrl");
  return { vote: serializeVote(vote), voteCount: result.voteCount };
}

export async function removeVote({ groupId, itemId, userId }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const item = await findQueueItem(group._id, itemId);
  ensureVoting(item);
  if (!(await Vote.exists({ queueItem: item._id, user: userId }))) {
    throw new AppError("VOTE_NOT_FOUND", "Voto nao encontrado.", 404);
  }

  const voteCount = await withTransaction(async (session) => {
    const vote = await Vote.findOneAndDelete({ queueItem: item._id, user: userId }, { session });
    if (!vote) throw new AppError("VOTE_NOT_FOUND", "Voto nao encontrado.", 404);

    const updatedItem = await QueueItem.findOneAndUpdate(
      {
        _id: item._id,
        group: group._id,
        status: QUEUE_STATUS.VOTING,
        voteCount: { $gt: 0 },
      },
      { $inc: { voteCount: -1 } },
      { new: true, session },
    );
    if (!updatedItem) {
      const currentItem = await QueueItem.findById(item._id).session(session);
      if (currentItem?.status !== QUEUE_STATUS.VOTING) throw queueNotVotingError();
      throw new AppError(
        "VOTE_COUNT_INCONSISTENT",
        "Nao foi possivel atualizar a contagem de votos.",
        500,
      );
    }
    return updatedItem.voteCount;
  });

  return { queueItemId: item._id.toString(), voteCount };
}

export async function listVotes({ groupId, itemId, userId, page, limit }) {
  const { group } = await getActiveGroupContext(groupId, userId);
  const item = await findQueueItem(group._id, itemId);
  const filter = { queueItem: item._id };
  const [total, votes] = await Promise.all([
    Vote.countDocuments(filter),
    Vote.find(filter)
      .populate("user", "name avatarUrl")
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);
  return {
    votes: votes.map(serializeVote),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
