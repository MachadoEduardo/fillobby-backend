import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Grupo é obrigatório"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Usuario é obrigatório"],
    },
    role: {
      type: String,
      required: [true, "Papel é obrigatório"],
      enum: ["OWNER", "ADMIN", "MEMBER"],
      default: "MEMBER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "REMOVED"],
      default: "ACTIVE",
    },
    joinedAt: {
      type: Date,
      default: mongoose.now,
    },
  },
  { timestamps: true },
);

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
groupMemberSchema.index({ user: 1, status: 1 });

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);

export default GroupMember;
