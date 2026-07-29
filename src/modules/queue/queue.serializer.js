function id(value) {
  return value?.toString();
}

function referenceId(value) {
  return id(value?._id ?? value);
}

function serializeUserSummary(user) {
  return {
    id: referenceId(user),
    name: user?.name,
    avatarUrl: user?.avatarUrl ?? null,
  };
}

export function serializeQueueItem(item) {
  const game = item.game;
  const suggestedBy = item.suggestedBy;

  return {
    id: id(item._id),
    groupId: referenceId(item.group),
    game: {
      id: referenceId(game),
      title: game?.title,
      platforms: game?.platforms,
      maxPlayers: game?.maxPlayers ?? null,
      coverUrl: game?.coverUrl ?? null,
    },
    suggestedBy: serializeUserSummary(suggestedBy),
    status: item.status,
    voteCount: item.voteCount,
    participantIds: item.participants.map(referenceId),
    participants: item.participants.map(serializeUserSummary),
    readyUserIds: item.readyUsers.map(referenceId),
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
