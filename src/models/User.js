import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nome e obrigatorio"],
      trim: true,
      minLength: [2, "Nome deve ter no minimo 2 caracteres"],
      maxLength: [80, "Nome deve ter no maximo 80 caracteres"],
    },
    email: {
      type: String,
      required: [true, "Email e obrigatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email invalido"],
    },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, trim: true, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
