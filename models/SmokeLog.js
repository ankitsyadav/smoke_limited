const mongoose = require('mongoose');

const smokeLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  trigger: { type: String, enum: ['stress', 'boredom', 'social', 'craving', 'habit', 'after-meal', 'anxiety', 'other', ''], default: '' },
  mood: { type: String, enum: ['stressed', 'anxious', 'bored', 'relaxed', 'angry', 'sad', 'happy', 'neutral', ''], default: '' },
  note: { type: String, default: '' },
  aiAdvice: { type: String, default: '' }
});

module.exports = mongoose.model('SmokeLog', smokeLogSchema);
