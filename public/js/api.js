// api.js — Hybrid storage: Server API (local) + localStorage (Vercel/static)
// Automatically falls back to localStorage when server API is unavailable

const STORAGE_KEY = 'vsv_study_stats';

// --- Default stats ---
function getDefaultStats() {
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

// --- Level calculation (mirrors server logic) ---
function calcLevel(xp) {
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

// --- Streak calculation (mirrors server logic) ---
function updateStreak(stats) {
    const today = new Date().toISOString().split('T')[0];
    if (!stats.lastStudyDate) {
        stats.currentStreak = 1;
    } else {
        const last = new Date(stats.lastStudyDate);
        const now = new Date(today);
        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            // Same day
        } else if (diffDays === 1) {
            stats.currentStreak += 1;
        } else {
            stats.currentStreak = 1;
        }
    }
    stats.lastStudyDate = today;
    return stats;
}

// --- localStorage helpers ---
function readLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : getDefaultStats();
    } catch {
        return getDefaultStats();
    }
}

function writeLocal(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('localStorage write failed:', e);
    }
}

// --- Detect if server API is available ---
let _serverAvailable = null; // null = unknown, true/false = cached result

async function isServerAvailable() {
    if (_serverAvailable !== null) return _serverAvailable;
    try {
        const res = await fetch('/api/stats', { method: 'GET', signal: AbortSignal.timeout(2000) });
        _serverAvailable = res.ok;
    } catch {
        _serverAvailable = false;
    }
    return _serverAvailable;
}

// ====== PUBLIC API (same interface, hybrid backend) ======

export async function fetchStats() {
    if (await isServerAvailable()) {
        const res = await fetch('/api/stats');
        return res.json();
    }
    // Fallback: localStorage
    const stats = readLocal();
    const levelInfo = calcLevel(stats.xp);
    return { ...stats, ...levelInfo };
}

export async function saveSession(durationMin) {
    if (await isServerAvailable()) {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationMin })
        });
        return res.json();
    }
    // Fallback: localStorage
    let stats = readLocal();

    const session = {
        date: new Date().toISOString(),
        durationMin: Math.round(durationMin * 10) / 10
    };
    stats.sessions.push(session);

    stats.totalSessions += 1;
    stats.totalMinutes = Math.round((stats.totalMinutes + durationMin) * 10) / 10;

    if (durationMin > stats.longestSessionMin) {
        stats.longestSessionMin = Math.round(durationMin * 10) / 10;
    }

    const earnedXP = Math.round(durationMin * 10);
    stats.xp += earnedXP;

    stats = updateStreak(stats);

    if (stats.sessions.length > 50) {
        stats.sessions = stats.sessions.slice(-50);
    }

    writeLocal(stats);

    const levelInfo = calcLevel(stats.xp);
    return { ...stats, ...levelInfo, earnedXP };
}

export async function resetStats() {
    if (await isServerAvailable()) {
        const res = await fetch('/api/stats/reset', { method: 'POST' });
        return res.json();
    }
    // Fallback: localStorage
    const fresh = getDefaultStats();
    writeLocal(fresh);
    const levelInfo = calcLevel(0);
    return { ...fresh, ...levelInfo };
}

// --- Sync save for beforeunload (works with both backends) ---
export function saveSessionSync(durationMin) {
    if (_serverAvailable) {
        const data = JSON.stringify({ durationMin });
        navigator.sendBeacon('/api/sessions', new Blob([data], { type: 'application/json' }));
    } else {
        // Direct localStorage save (synchronous, works in beforeunload)
        try {
            let stats = readLocal();
            const session = {
                date: new Date().toISOString(),
                durationMin: Math.round(durationMin * 10) / 10
            };
            stats.sessions.push(session);
            stats.totalSessions += 1;
            stats.totalMinutes = Math.round((stats.totalMinutes + durationMin) * 10) / 10;
            if (durationMin > stats.longestSessionMin) {
                stats.longestSessionMin = Math.round(durationMin * 10) / 10;
            }
            stats.xp += Math.round(durationMin * 10);
            updateStreak(stats);
            if (stats.sessions.length > 50) stats.sessions = stats.sessions.slice(-50);
            writeLocal(stats);
        } catch (e) {
            console.warn('Sync save failed:', e);
        }
    }
}
