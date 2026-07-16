import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nome é obrigatório"],
      trim: true,
      minLength: [3, "Nome deve ter no mínimo 3 caracteres"],
      maxLength: [50, "Nome deve ter no máximo 50 caracteres"],
    },
    description: {
      type: String,
      maxLength: [500, "Descricao deve ter no máximo 500 caracteres"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Dono é obrigatório"],
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Group = mongoose.model("Group", groupSchema);

export default Group;
