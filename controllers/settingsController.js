const UserSettings = require('../models/UserSettings');

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await UserSettings.findOne({ userId: req.session.userId });
    res.render('settings', { title: 'Settings', settings });
  } catch (err) {
    next(err);
  }
};

exports.saveSettings = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { costPerCigarette, dailyGoal } = req.body;
    await UserSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        costPerCigarette: Number(costPerCigarette),
        dailyGoal: Number(dailyGoal) || 5
      },
      { upsert: true, new: true }
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
};
