import Game from "../../models/Game.js";
import AppError from "../../shared/errors/AppError.js";

function normalizeTitle(title) {
  return title.trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

function duplicateGameError() {
  return new AppError(
    "GAME_ALREADY_EXISTS",
    "Este jogo ja esta cadastrado.",
    409,
  );
}

function serializeGame(game) {
  return {
    id: game._id.toString(),
    title: game.title,
    platforms: game.platforms,
    maxPlayers: game.maxPlayers ?? null,
    coverUrl: game.coverUrl ?? null,
    description: game.description ?? null,
    createdById: game.createdBy.toString(),
    isActive: game.isActive,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findActiveGame(gameId) {
  const game = await Game.findOne({ _id: gameId, isActive: true });
  if (!game) throw new AppError("GAME_NOT_FOUND", "Jogo nao encontrado.", 404);
  return game;
}

function requireAuthor(game, userId) {
  if (game.createdBy.toString() !== userId.toString()) {
    throw new AppError(
      "GAME_AUTHOR_REQUIRED",
      "Somente o autor pode alterar este jogo.",
      403,
    );
  }
}

export async function createGame({ userId, data }) {
  const normalizedTitle = normalizeTitle(data.title);
  if (await Game.exists({ normalizedTitle })) throw duplicateGameError();

  try {
    const game = await Game.create({
      ...data,
      normalizedTitle,
      createdBy: userId,
    });
    return serializeGame(game);
  } catch (error) {
    if (error?.code === 11000 && error.keyPattern?.normalizedTitle)
      throw duplicateGameError();
    throw error;
  }
}

export async function listGames({ search, platform, page, limit }) {
  const filter = { isActive: true };
  if (search) filter.title = { $regex: escapeRegex(search), $options: "i" };
  if (platform) filter.platforms = platform;

  const [total, games] = await Promise.all([
    Game.countDocuments(filter),
    Game.find(filter)
      .sort({ title: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    games: games.map(serializeGame),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getGame(gameId) {
  return serializeGame(await findActiveGame(gameId));
}

export async function updateGame({ gameId, userId, changes }) {
  const game = await findActiveGame(gameId);
  requireAuthor(game, userId);

  if (changes.title !== undefined) {
    const normalizedTitle = normalizeTitle(changes.title);
    if (await Game.exists({ normalizedTitle, _id: { $ne: game._id } }))
      throw duplicateGameError();
    game.normalizedTitle = normalizedTitle;
  }

  Object.assign(game, changes);
  try {
    await game.save();
    return serializeGame(game);
  } catch (error) {
    if (error?.code === 11000 && error.keyPattern?.normalizedTitle)
      throw duplicateGameError();
    throw error;
  }
}

export async function deleteGame({ gameId, userId }) {
  const game = await findActiveGame(gameId);
  requireAuthor(game, userId);
  game.isActive = false;
  await game.save();
  return { id: game._id.toString(), isActive: false };
}
