const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  password: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving (only when modified)
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();
    const hash = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hash;
    next();
  } catch (err) {
    next(err);
  }
});

// Instance helper to compare password
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
