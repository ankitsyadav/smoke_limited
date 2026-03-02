const mongoose = require('mongoose');

const dailyHealthMetricsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  hrv: { type: Number, required: true },
  restingHR: { type: Number, required: true },
  sleepScore: { type: Number, required: true },
  spo2: { type: Number, required: true }
});

// Compound unique index: one health entry per user per day
dailyHealthMetricsSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyHealthMetrics', dailyHealthMetricsSchema);
