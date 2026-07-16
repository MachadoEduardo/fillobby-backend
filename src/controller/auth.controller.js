import bcrypt from ('bcrypt');
import jwt from ('jsonwebtoken');
import env from ('../config/env');
import userRepository from ('../repository/user.repository');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(422).json({ message: 'Nome, email e senha são obrigatórios' });
    }

    const userExists = await userRepository.findByEmail(email);

    if (userExists) {
      return res.status(409).json({ message: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userRepository.create({
      name,
      email,
      password: hashedPassword
    });

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(422).json({ message: 'Email e senha são obrigatórios' });
    }

    const user = await userRepository.findByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user._id },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        nome: user.name,
        email: user.email
      },
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  register,
  login
};