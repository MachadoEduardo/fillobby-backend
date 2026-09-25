import mongoose from "mongoose";

const userAvatarSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp"],
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 2 * 1024 * 1024,
    },
  },
  { timestamps: true },
);

const UserAvatar = mongoose.model("UserAvatar", userAvatarSchema);

export default UserAvatar;
