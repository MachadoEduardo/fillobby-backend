import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Group from "../../models/Group.js";
import GroupMember from "../../models/GroupMember.js";
import QueueItem from "../../models/QueueItem.js";
import Vote from "../../models/Vote.js";
import AppError from "../../shared/errors/AppError.js";
import {
  ACTIVE_QUEUE_STATUSES,
  QUEUE_STATUS,
} from "../queue/queue.constants.js";

const PRE_PLAYING_STATUSES = [
  QUEUE_STATUS.SUGGESTED,
  QUEUE_STATUS.VOTING,
  QUEUE_STATUS.WAITING_PLAYERS,
  QUEUE_STATUS.READY,
];

function inviteCode() {
  return randomBytes(6).toString("hex").toUpperCase();
}

function id(value) {
  return value?.toString();
}

function serializeGroup(group, membership, includeInvite = false) {
  const result = {
    id: id(group._id),
    name: group.name,
    description: group.description ?? null,
    ownerId: id(group.owner),
    isActive: group.isActive,
    role: membership?.role,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };

  if (includeInvite) result.inviteCode = group.inviteCode;

  return result;
}

function serializeMember(member) {
  const user = member.user;

  return {
    id: id(user._id ?? user),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
  };
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

export async function getActiveGroupContext(groupId, userId) {
  if (!mongoose.isValidObjectId(groupId))
    throw new AppError("GROUP_NOT_FOUND", "Grupo nao encontrado.", 404);

  const group = await Group.findOne({ _id: groupId, isActive: true });

  if (!group)
    throw new AppError("GROUP_NOT_FOUND", "Grupo nao encontrado.", 404);

  const membership = await GroupMember.findOne({
    group: group._id,
    user: userId,
    status: "ACTIVE",
  });

  if (!membership)
    throw new AppError("GROUP_NOT_FOUND", "Grupo nao encontrado.", 404);

  return { group, membership };
}

function requireRole(membership, roles) {
  if (!roles.includes(membership.role))
    throw new AppError(
      "INSUFFICIENT_GROUP_ROLE",
      "Voce nao possui permissao para esta operacao.",
      403,
    );
}

async function deactivateMembership({ group, membership, userId, status, session }) {
  const targetUserId = new mongoose.Types.ObjectId(id(userId));

  membership.status = status;
  membership.role = "MEMBER";
  await membership.save({ session });

  await QueueItem.updateMany(
    { group: group._id, status: { $in: PRE_PLAYING_STATUSES } },
    [
      {
        $set: {
          participants: { $setDifference: ["$participants", [targetUserId]] },
          readyUsers: { $setDifference: ["$readyUsers", [targetUserId]] },
        },
      },
      {
        $set: {
          status: {
            $cond: [
              {
                $in: [
                  "$status",
                  [QUEUE_STATUS.WAITING_PLAYERS, QUEUE_STATUS.READY],
                ],
              },
              {
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
              },
              "$status",
            ],
          },
        },
      },
    ],
    { session, updatePipeline: true },
  );

  const items = await QueueItem.find({
    group: group._id,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  })
    .select("_id")
    .session(session);
  const itemIds = items.map((item) => item._id);
  const votes = await Vote.find({
    user: targetUserId,
    queueItem: { $in: itemIds },
  })
    .select("queueItem")
    .session(session);

  if (!votes.length) return;

  await Vote.deleteMany(
    { _id: { $in: votes.map((vote) => vote._id) } },
    { session },
  );
  await QueueItem.bulkWrite(
    votes.map((vote) => ({
      updateOne: {
        filter: { _id: vote.queueItem, voteCount: { $gt: 0 } },
        update: { $inc: { voteCount: -1 } },
      },
    })),
    { session },
  );
}

export async function createGroup({ userId, name, description }) {
  for (let attempt = 0; attempt < 3; attempt ++) {
    try {
      return await transaction(async (session) => {
        const group = await Group.create(
          [
            {
              name,
              description: description ?? null,
              owner: userId,
              inviteCode: inviteCode(),
            },
          ],
          { session },
        );

        await GroupMember.create(
          [
            {
              group: group[0]._id,
              user: userId,
              role: "OWNER",
              status: "ACTIVE",
            },
          ],
          { session },
        );
        return serializeGroup(group[0], { role: "OWNER" }, true);
      });
    } catch (error) {
      if (
        error?.code !== 11000 ||
        !error.keyPattern?.inviteCode ||
        attempt === 2
      )
        throw error;
    }
  }
  throw new Error("Nao foi possivel gerar convite");
}

export async function listGroups({ userId, page, limit }) {
  const memberships = await GroupMember.find({
    user: userId,
    status: "ACTIVE",
  }).sort({ updatedAt: -1 });

  const groupIds = memberships.map((item) => item.group);
  const groups = await Group.find({
    _id: { $in: groupIds },
    isActive: true,
  }).sort({ updatedAt: -1 });

  const membershipMap = new Map(
    memberships.map((item) => [id(item.group), item]),
  );

  const total = groups.length;
  const items = groups.slice((page - 1) * limit, page * limit).map((group) => {
    const member = membershipMap.get(id(group._id));

    return serializeGroup(
      group,
      member,
      ["OWNER", "ADMIN"].includes(member?.role),
    );
  });
  return {
    groups: items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getGroup({ groupId, userId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);

  return serializeGroup(
    group,
    membership,
    ["OWNER", "ADMIN"].includes(membership.role),
  );
}

export async function updateGroup({ groupId, userId, changes }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER", "ADMIN"]);
  Object.assign(group, changes);
  await group.save();

  return serializeGroup(
    group,
    membership,
    ["OWNER", "ADMIN"].includes(membership.role),
  );
}

export async function joinGroup({ userId, inviteCode: code }) {
  const group = await Group.findOne({
    inviteCode: code.toUpperCase(),
    isActive: true,
  });

  if (!group)
    throw new AppError("INVITE_NOT_FOUND", "Convite nao encontrado.", 404);

  const existing = await GroupMember.findOne({
    group: group._id,
    user: userId,
  });

  if (existing?.status === "ACTIVE")
    return {
      group: serializeGroup(group, existing, ["OWNER", "ADMIN"].includes(existing.role)),
      joined: false,
    };

  if (existing?.status === "REMOVED")
    throw new AppError(
      "MEMBERSHIP_REMOVED",
      "Este usuario foi removido do grupo.",
      403,
    );

  try {
    const membership = existing
      ? await GroupMember.findByIdAndUpdate(
          existing._id,
          { status: "ACTIVE", role: "MEMBER", joinedAt: new Date() },
          { new: true },
        )
      : await GroupMember.create({
          group: group._id,
          user: userId,
          role: "MEMBER",
          status: "ACTIVE",
        });
    return { group: serializeGroup(group, membership, false), joined: true };
  } catch (error) {
    if (error?.code === 11000) {
      const current = await GroupMember.findOne({ group: group._id, user: userId });
      if (current?.status === "ACTIVE")
        return {
          group: serializeGroup(group, current, ["OWNER", "ADMIN"].includes(current.role)),
          joined: false,
        };
      if (current?.status === "REMOVED")
        throw new AppError(
          "MEMBERSHIP_REMOVED",
          "Este usuario foi removido do grupo.",
          403,
        );
    }
    throw error;
  }
}

export async function listMembers({ groupId, userId, page, limit, status }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  if (status === "REMOVED") requireRole(membership, ["OWNER", "ADMIN"]);

  const query = { group: group._id, status };
  const [total, members] = await Promise.all([
    GroupMember.countDocuments(query),
    GroupMember.find(query)
      .populate("user", "name email avatarUrl")
      .sort({ joinedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    members: members.map(serializeMember),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function changeRole({ groupId, userId, targetUserId, role }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER"]);
  const target = await GroupMember.findOne({
    group: group._id,
    user: targetUserId,
    status: "ACTIVE",
  });

  if (!target)
    throw new AppError("GROUP_MEMBER_NOT_FOUND", "Membro nao encontrado.", 404);

  if (target.role === "OWNER")
    throw new AppError(
      "OWNER_ROLE_IMMUTABLE",
      "Transfira a propriedade para alterar este papel.",
      409,
    );

  target.role = role;
  await target.save();

  return serializeMember(await target.populate("user", "name email avatarUrl"));
}

export async function removeMember({ groupId, userId, targetUserId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER", "ADMIN"]);
  if (id(userId) === id(targetUserId))
    throw new AppError(
      "CANNOT_REMOVE_SELF",
      "Nao e possivel remover a si mesmo.",
      409,
    );

  const target = await GroupMember.findOne({
    group: group._id,
    user: targetUserId,
    status: "ACTIVE",
  });

  if (!target)
    throw new AppError("GROUP_MEMBER_NOT_FOUND", "Membro nao encontrado.", 404);

  if (
    target.role === "OWNER" ||
    (membership.role === "ADMIN" && target.role !== "MEMBER")
  )
    throw new AppError(
      "INSUFFICIENT_GROUP_ROLE",
      "Voce nao pode remover este membro.",
      403,
    );

  await transaction(async (session) => {
    await deactivateMembership({
      group,
      membership: target,
      userId: targetUserId,
      status: "REMOVED",
      session,
    });
  });

  return { userId: id(targetUserId), status: "REMOVED" };
}

export async function leaveGroup({ groupId, userId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  if (membership.role === "OWNER") {
    throw new AppError(
      "OWNER_CANNOT_LEAVE",
      "Transfira a propriedade ou exclua o grupo antes de sair.",
      409,
    );
  }

  await transaction(async (session) => {
    await deactivateMembership({
      group,
      membership,
      userId,
      status: "INACTIVE",
      session,
    });
  });

  return { userId: id(userId), status: "INACTIVE" };
}

export async function restoreMember({ groupId, userId, targetUserId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER", "ADMIN"]);

  const target = await GroupMember.findOne({
    group: group._id,
    user: targetUserId,
    status: "REMOVED",
  });
  if (!target) {
    throw new AppError("GROUP_MEMBER_NOT_FOUND", "Membro nao encontrado.", 404);
  }

  target.status = "ACTIVE";
  target.role = "MEMBER";
  target.joinedAt = new Date();
  await target.save();
  return serializeMember(await target.populate("user", "name email avatarUrl"));
}

export async function regenerateInviteCode({ groupId, userId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER", "ADMIN"]);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    group.inviteCode = inviteCode();
    try {
      await group.save();
      return serializeGroup(group, membership, true);
    } catch (error) {
      if (
        error?.code !== 11000 ||
        !error.keyPattern?.inviteCode ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error("Nao foi possivel gerar convite");
}

export async function transferOwner({ groupId, userId, newOwnerId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER"]);
  if (id(userId) === id(newOwnerId))
    throw new AppError(
      "INVALID_OWNER_TRANSFER",
      "O novo dono deve ser outro membro.",
      422,
    );

  return transaction(async (session) => {
    const target = await GroupMember.findOne({
      group: group._id,
      user: newOwnerId,
      status: "ACTIVE",
    }).session(session);

    if (!target)
      throw new AppError(
        "GROUP_MEMBER_NOT_FOUND",
        "Membro nao encontrado.",
        404,
      );

    await GroupMember.updateOne(
      { _id: membership._id },
      { $set: { role: "ADMIN" } },
      { session },
    );

    await GroupMember.updateOne(
      { _id: target._id },
      { $set: { role: "OWNER" } },
      { session },
    );

    group.owner = newOwnerId;
    await group.save({ session });

    return serializeGroup(group, { role: "ADMIN" }, true);
  });
}

export async function deleteGroup({ groupId, userId }) {
  const { group, membership } = await getActiveGroupContext(groupId, userId);
  requireRole(membership, ["OWNER"]);
  await transaction(async (session) => {
    await Group.updateOne(
      { _id: group._id },
      { $set: { isActive: false } },
      { session },
    );
    
    await GroupMember.updateMany(
      { group: group._id, status: "ACTIVE" },
      { $set: { status: "INACTIVE" } },
      { session },
    );
  });

  return { id: id(group._id), isActive: false };
}
