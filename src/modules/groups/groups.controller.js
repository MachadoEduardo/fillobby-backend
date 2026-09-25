import * as groupsService from "./groups.service.js";

const actor = (req) => req.user._id;

export async function create(req, res, next) {
  try {
    return res.status(201).json({
      success: true,
      data: await groupsService.createGroup({
        userId: actor(req),
        ...req.body,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.listGroups({
        userId: actor(req),
        ...req.validated.query,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.getGroup({
        groupId: req.validated.params.groupId,
        userId: actor(req),
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.updateGroup({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        changes: req.body,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function join(req, res, next) {
  try {
    const { group, joined } = await groupsService.joinGroup({
      userId: actor(req),
      ...req.body,
    });
    return res.status(joined ? 201 : 200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    return next(error);
  }
}

export async function members(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.listMembers({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        ...req.validated.query,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function changeRole(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.changeRole({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        targetUserId: req.validated.params.userId,
        role: req.body.role,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.removeMember({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        targetUserId: req.validated.params.userId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function leave(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.leaveGroup({
        groupId: req.validated.params.groupId,
        userId: actor(req),
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function restoreMember(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.restoreMember({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        targetUserId: req.validated.params.userId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function regenerateInvite(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.regenerateInviteCode({
        groupId: req.validated.params.groupId,
        userId: actor(req),
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function transferOwner(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.transferOwner({
        groupId: req.validated.params.groupId,
        userId: actor(req),
        newOwnerId: req.body.newOwnerId,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: await groupsService.deleteGroup({
        groupId: req.validated.params.groupId,
        userId: actor(req),
      }),
    });
  } catch (error) {
    return next(error);
  }
}
