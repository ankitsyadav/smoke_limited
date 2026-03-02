const User = require('../models/User');
const UserSettings = require('../models/UserSettings');

exports.getLogin = (req, res) => {
  res.render('login', { title: 'Login', error: null });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', { title: 'Login', error: 'Email aur password dono daal do.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('login', { title: 'Login', error: 'Email ya password galat hai.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('login', { title: 'Login', error: 'Email ya password galat hai.' });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.userCreatedAt = user.createdAt;
    res.redirect('/');
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.render('login', { title: 'Login', error: 'Kuch galat ho gaya. Try again.' });
  }
};

exports.getSignup = (req, res) => {
  res.render('signup', { title: 'Sign Up', error: null });
};

exports.postSignup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.render('signup', { title: 'Sign Up', error: 'Sab fields bharo.' });
    }

    if (password.length < 4) {
      return res.render('signup', { title: 'Sign Up', error: 'Password kam se kam 4 characters ka hona chahiye.' });
    }

    if (password !== confirmPassword) {
      return res.render('signup', { title: 'Sign Up', error: 'Passwords match nahi kar rahe.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('signup', { title: 'Sign Up', error: 'Ye email pehle se registered hai. Login karo.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    // Create default settings for the new user
    await UserSettings.create({
      userId: user._id,
      costPerCigarette: 15,
      dailyGoal: 5,
      email: user.email
    });

    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.userCreatedAt = user.createdAt;
    res.redirect('/');
  } catch (err) {
    console.error('[AUTH] Signup error:', err.message);
    res.render('signup', { title: 'Sign Up', error: 'Kuch galat ho gaya. Try again.' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
