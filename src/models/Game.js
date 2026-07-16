import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Título é obrigatório"],
      minLength: [1, "Tamanho mínimo de caracteres do título: 1"],
      maxLength: [120, "Tamanho máximo de caracteres do título: 120"],
    },
    platforms: {
      type: [String],
      required: [true, "Plataforma é obrigatório"],
      enum: ["PC", "PlayStation", "Xbox", "Switch"],
      validate: {
        validator: (values) => values.length > 0,
        message: "Informe pelo menos uma plataforma",
      },
    },
    maxPlayers: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Máximo de jogadores deve ser um número inteiro",
      },
    },
    coverUrl: {
      type: String,
    },
    description: {
      type: String,
      maxLength: [1000, "O tamanho máximo e 1000 caracteres"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Criador é obrigatório"],
    },
    isActive: {
        type: Boolean,
        default: true
    }
  },
  { timestamps: true },
);

const Game = mongoose.model("Game", gameSchema);

export default Game;
