import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Grupo é obrigatório"],
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: [true, "Jogo é obrigatório"],
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Quem sugeriu é obrigatório"],
    },
    status: {
      type: String,
      enum: [
        "SUGGESTED",
        "VOTING",
        "WAITING_PLAYERS",
        "READY",
        "PLAYING",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "SUGGESTED",
    },
    participants: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: []
    },
    readyUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: []
    },
    voteCount: {
      type: Number,
      default: 0,
      min: 0
    },
    completedAt: {
      type: Date,
      default: null
    },
  },
  { timestamps: true },
);

queueSchema.index(
    {group: 1, game: 1},
    {
        unique: true,
        partialFilterExpression: {
            status: {
                $in: ['SUGGESTED', 'VOTING', 'WAITING_PLAYERS', 'READY', 'PLAYING']
            }
        }
    }
)
queueSchema.index({ group: 1, status: 1, voteCount: -1, createdAt: 1 });
queueSchema.index({group: 1, completedAt: -1});

const QueueItem = mongoose.model("QueueItem", queueSchema);

export default QueueItem;
