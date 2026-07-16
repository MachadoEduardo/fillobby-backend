import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    queueItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QueueItem",
      required: [true, "Item da fila é obrigatório"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Usuário é obrigatório"],
    },
  },
  { timestamps: true },
);

voteSchema.index({ queueItem: 1, user: 1 }, { unique: true });
voteSchema.index({ queueItem: 1, createdAt: 1 });

const Vote = mongoose.model("Vote", voteSchema);

export default Vote;
