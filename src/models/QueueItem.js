import mongoose from "mongoose";
import {
  ACTIVE_QUEUE_STATUSES,
  QUEUE_STATUS,
} from "../modules/queue/queue.constants.js";

const queueItemSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(QUEUE_STATUS),
      default: QUEUE_STATUS.SUGGESTED,
    },
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    readyUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    voteCount: { type: Number, default: 0, min: 0 },
    votingRound: { type: mongoose.Schema.Types.ObjectId, ref: "VotingRound", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

queueItemSchema.index(
  { group: 1, game: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_QUEUE_STATUSES } },
  },
);
queueItemSchema.index({ group: 1, status: 1, voteCount: -1, createdAt: 1 });
queueItemSchema.index({ group: 1, completedAt: -1 });

export default mongoose.model("QueueItem", queueItemSchema);
