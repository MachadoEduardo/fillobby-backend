import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true,
        minLength: [3, 'Nome deve ter no mínimo 3 caracteres'],
        maxLength: [50, 'Nome deve ter no máximo 50 caracteres']
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
    avatarUrl: {
        type: String,
        trim: true,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
