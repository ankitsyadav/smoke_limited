const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  costPerCigarette: { type: Number, required: true },
  dailyGoal: { type: Number, default: 5 },
  email: { type: String, required: true },
  lastEmailSent: { type: Date, default: null },
  lastPatternEmailSent: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);
