import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      required: true,
      enum: ["OWNER", "ADMIN", "MEMBER"],
      default: "MEMBER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "REMOVED"],
      default: "ACTIVE",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
groupMemberSchema.index({ user: 1, status: 1 });
groupMemberSchema.index({ group: 1, status: 1, role: 1 });

export default mongoose.model("GroupMember", groupMemberSchema);
