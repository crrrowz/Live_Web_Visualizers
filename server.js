const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'stats.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper: Read / Write JSON ---
function readStats() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {
            totalSessions: 0,
            totalMinutes: 0,
            currentStreak: 0,
            lastStudyDate: null,
            longestSessionMin: 0,
            level: 1,
            xp: 0,
            sessions: []
        };
    }
}

function writeStats(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Helper: Calculate level from XP ---
function calcLevel(xp) {
    // Each level needs more XP: level N needs N*100 XP
    let level = 1;
    let needed = 100;
    let remaining = xp;
    while (remaining >= needed) {
        remaining -= needed;
        level++;
        needed = level * 100;
    }
    return { level, xpInLevel: remaining, xpForNext: needed };
}

// --- Helper: Update streak ---
function updateStreak(stats) {
    const today = new Date().toISOString().split('T')[0];
    if (!stats.lastStudyDate) {
        stats.currentStreak = 1;
    } else {
        const last = new Date(stats.lastStudyDate);
        const now = new Date(today);
        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            // Same day, streak unchanged
        } else if (diffDays === 1) {
            stats.currentStreak += 1;
        } else {
            stats.currentStreak = 1; // Reset streak
        }
    }
    stats.lastStudyDate = today;
    return stats;
}

// ====== API ROUTES ======

// GET stats
app.get('/api/stats', (req, res) => {
    const stats = readStats();
    const levelInfo = calcLevel(stats.xp);
    res.json({ ...stats, ...levelInfo });
});

// POST: End a study session
app.post('/api/sessions', (req, res) => {
    const { durationMin } = req.body;
    if (!durationMin || durationMin < 0) {
        return res.status(400).json({ error: 'Invalid duration' });
    }

    let stats = readStats();

    // Add session
    const session = {
        date: new Date().toISOString(),
        durationMin: Math.round(durationMin * 10) / 10
    };
    stats.sessions.push(session);

    // Update totals
    stats.totalSessions += 1;
    stats.totalMinutes = Math.round((stats.totalMinutes + durationMin) * 10) / 10;

    // Longest session
    if (durationMin > stats.longestSessionMin) {
        stats.longestSessionMin = Math.round(durationMin * 10) / 10;
    }

    // XP: 10 XP per minute studied
    const earnedXP = Math.round(durationMin * 10);
    stats.xp += earnedXP;

    // Streak
    stats = updateStreak(stats);

    // Keep only last 50 sessions
    if (stats.sessions.length > 50) {
        stats.sessions = stats.sessions.slice(-50);
    }

    writeStats(stats);

    const levelInfo = calcLevel(stats.xp);
    res.json({ ...stats, ...levelInfo, earnedXP });
});

// POST: Reset all stats
app.post('/api/stats/reset', (req, res) => {
    const fresh = {
        totalSessions: 0,
        totalMinutes: 0,
        currentStreak: 0,
        lastStudyDate: null,
        longestSessionMin: 0,
        level: 1,
        xp: 0,
        sessions: []
    };
    writeStats(fresh);
    const levelInfo = calcLevel(0);
    res.json({ ...fresh, ...levelInfo });
});

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  🎙️  Voice Study Visualizer`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Running at: http://localhost:${PORT}\n`);
});
