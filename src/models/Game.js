import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Titulo e obrigatorio"],
      trim: true,
      minLength: [1, "Titulo deve ter no minimo 1 caractere"],
      maxLength: [120, "Titulo deve ter no maximo 120 caracteres"],
    },
    normalizedTitle: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    platforms: {
      type: [String],
      required: [true, "Plataformas sao obrigatorias"],
      enum: ["PC", "PlayStation", "Xbox", "Switch"],
      validate: {
        validator: (values) =>
          values.length > 0 && new Set(values).size === values.length,
        message: "Informe plataformas sem duplicatas",
      },
    },
    maxPlayers: {
      type: Number,
      default: null,
      min: [1, "Maximo de jogadores deve ser maior que zero"],
      validate: {
        validator: (value) => value === null || Number.isInteger(value),
        message: "Maximo de jogadores deve ser um numero inteiro",
      },
    },
    coverUrl: { type: String, trim: true, default: null },
    description: { type: String, trim: true, maxLength: 1000, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Game", gameSchema);
