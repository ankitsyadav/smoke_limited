# SmokeLimited — Smoking Relapse Prediction System

A mobile-first behavioral analytics dashboard that tracks smoking patterns, predicts relapse risk using AI, and sends email alerts when risk is high.

## Features

- **One-tap smoke logging** with "I Smoked" button
- **Risk score engine** (0–100) with color-coded levels
- **Pattern detection** — peak hour, rapid repeats, trend analysis
- **xAI Grok integration** for personalized AI advice
- **Health tracking** — HRV, Resting HR, Sleep Score, SpO2
- **Financial impact** — daily, monthly, yearly, lifetime costs
- **Email alerts** when risk ≥ 60 (with 2-hour cooldown)
- **Cron job** — recalculates risk every 30 minutes
- **Charts** — 7-day line chart, hourly bar chart
- **Olive green 3D glass UI** — mobile-first, animated

---

## Setup Instructions

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd SmokeLimited
npm install
```

### 2. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user (username + password)
4. Go to **Network Access** → **Add IP Address** → Allow from anywhere (`0.0.0.0/0`)
5. Go to **Database** → **Connect** → **Connect your application**
6. Copy the connection string (replace `<password>` with your password)
7. Paste it in your `.env` as `MONGO_URI`

Example:
```
MONGO_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/smoke-tracker?retryWrites=true&w=majority
```

### 3. Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already on
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select **Mail** and **Other (Custom name)** → enter "SmokeLimited"
5. Copy the 16-character password
6. Paste in `.env`:

```
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

### 4. Grok API Key

1. Go to [x.ai Console](https://console.x.ai/)
2. Create an API key
3. Paste in `.env`:

```
GROK_API_KEY=xai-your-key-here
```

### 5. Create `.env` File

Copy the example and fill in your values:

```bash
cp .env.example .env
```

```env
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
GROK_API_KEY=your_xai_grok_api_key
MONGO_URI=mongodb://localhost:27017/smoke-tracker
PORT=3000
```

### 6. Run Locally

```bash
npm start
```

Open `http://localhost:3000` in your browser.

For development with auto-reload:

```bash
npm run dev
```

---

## Deploy on Render

1. Push your code to GitHub
2. Go to [Render](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node app.js`
   - **Environment:** Node
5. Add **Environment Variables** (from your `.env` file):
   - `MONGO_URI`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `GROK_API_KEY`
   - `PORT` = `3000`
6. Deploy

---

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB (Mongoose)
- **Views:** EJS + Bootstrap 5
- **Charts:** Chart.js
- **AI:** xAI Grok API
- **Email:** Nodemailer (Gmail SMTP)
- **Scheduler:** node-cron
- **Dates:** Moment.js
