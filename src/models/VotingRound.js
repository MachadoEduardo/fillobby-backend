import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "QueueItem", required: true },
    gameTitle: { type: String, required: true },
    voteCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const votingRoundSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    status: { type: String, enum: ["OPEN", "CLOSED", "CANCELLED"], default: "OPEN" },
    candidates: { type: [candidateSchema], required: true },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    winnerItem: { type: mongoose.Schema.Types.ObjectId, ref: "QueueItem", default: null },
  },
  { timestamps: true },
);

votingRoundSchema.index({ group: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "OPEN" } });
votingRoundSchema.index({ group: 1, createdAt: -1 });

export default mongoose.model("VotingRound", votingRoundSchema);
