const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ═══ MongoDB Connection ═══
const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://iamanujup79_db_user:iamanujup79_db_user@cluster0.yscdiem.mongodb.net/gyani?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ═══ Middleware ═══
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// Serve frontend from root
app.use(express.static(__dirname));

// ═══ Schema ═══
const ScoreSchema = new mongoose.Schema({
  playerId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 30 },
  emoji: { type: String, default: '🦁' },
  quizKey: { type: String, required: true, index: true },
  score: { type: Number, required: true, default: 0 },
  maxScore: { type: Number, required: true, default: 0 },
  accuracy: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  wrong: { type: Number, default: 0 },
  skip: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 }
}, { timestamps: true });

ScoreSchema.index({ playerId: 1, quizKey: 1 }, { unique: true });

const Score = mongoose.model('Score', ScoreSchema);

// ═══ API Routes ═══

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🎯 THE GYANI Leaderboard API',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// POST: Save score
app.post('/api/score', async (req, res) => {
  try {
    const {
      playerId, name, emoji, quizKey,
      score, maxScore, accuracy,
      correct, wrong, skip, total, timeTaken
    } = req.body;

    if (!playerId || !name || !quizKey) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const existing = await Score.findOne({ playerId, quizKey });

    if (existing) {
      const isBetter = score > existing.score ||
        (score === existing.score && accuracy > existing.accuracy);

      if (isBetter) {
        existing.score = score;
        existing.maxScore = maxScore;
        existing.accuracy = accuracy;
        existing.correct = correct;
        existing.wrong = wrong;
        existing.skip = skip;
        existing.total = total;
        existing.timeTaken = timeTaken;
        existing.name = name;
        existing.emoji = emoji;
        await existing.save();
        return res.json({ success: true, updated: true, entry: existing });
      }
      return res.json({ success: true, updated: false, entry: existing, message: 'Kept best' });
    }

    const newScore = new Score({
      playerId, name, emoji, quizKey,
      score, maxScore, accuracy,
      correct, wrong, skip, total, timeTaken
    });
    await newScore.save();
    res.json({ success: true, created: true, entry: newScore });

  } catch (err) {
    console.error('POST /api/score error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Leaderboard
app.get('/api/leaderboard/:quizKey', async (req, res) => {
  try {
    const { quizKey } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const myId = req.query.playerId || '';

    const scores = await Score.find({ quizKey })
      .sort({ score: -1, accuracy: -1, timeTaken: 1 })
      .limit(limit)
      .lean();

    let myRank = -1;
    if (myId) {
      const idx = scores.findIndex(s => s.playerId === myId);
      myRank = idx >= 0 ? idx + 1 : -1;
    }

    res.json({
      success: true,
      quizKey,
      total: scores.length,
      myRank,
      leaderboard: scores.map((s, i) => ({
        rank: i + 1,
        id: s.playerId,
        name: s.name,
        emoji: s.emoji,
        score: s.score,
        maxScore: s.maxScore,
        accuracy: s.accuracy,
        correct: s.correct,
        wrong: s.wrong,
        skip: s.skip,
        timeTaken: s.timeTaken,
        submittedAt: s.createdAt
      }))
    });
  } catch (err) {
    console.error('GET leaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
