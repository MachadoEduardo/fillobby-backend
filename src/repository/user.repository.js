import User from ('../models/User');

function create(data) {
  return User.create(data);
}

function findByEmail(email) {
  return User.findOne({ email: email.toLowerCase().trim() });
}

function findById(id) {
  return User.findById(id);
}

export default {
  create,
  findByEmail,
  findById,
};