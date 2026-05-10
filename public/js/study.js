// study.js — Study timer, motivational quotes, and UI updates
import { fetchStats, saveSession, resetStats, saveSessionSync as apiSaveSync } from './api.js';

// --- Motivational Quotes ---
const QUOTES = [
    "العلم نور، والجهل ظلام",
    "من جدّ وجد، ومن زرع حصد",
    "لا تؤجّل عمل اليوم إلى الغد",
    "النجاح ليس نهاية الطريق، والفشل ليس نهاية العالم",
    "اقرأ كثيراً، فإن القراءة ربيع العقل",
    "الصبر مفتاح الفرج",
    "كل دقيقة تستثمرها اليوم تصنع مستقبلك",
    "الطريق إلى النجاح يبدأ بخطوة واحدة",
    "لا تستسلم.. أنت أقرب مما تتصور",
    "العقل كالعضلة، كلما مرّنته أصبح أقوى",
    "كل جلسة دراسة تقرّبك من حلمك",
    "ليس المهم أن تبدأ بقوة، المهم ألّا تتوقف",
    "الانضباط يصنع العظماء",
    "اجعل كل يوم يقرّبك خطوة من هدفك",
    "الاستمرار هو سرّ التفوّق"
];

let sessionStartTime = null;
let timerInterval = null;
let currentQuoteIdx = 0;
let _flashHUD = null; // Will be set from app.js
let _levelUpdater = null; // Will be set from app.js

// --- Set flashHUD callback from app.js ---
export function setFlashHUD(fn) {
    _flashHUD = fn;
}

// --- Set level visual updater from app.js ---
export function setLevelUpdater(fn) {
    _levelUpdater = fn;
}

// --- Timer ---
export function startTimer() {
    sessionStartTime = Date.now();
    const timerEl = document.getElementById('timer');

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - sessionStartTime;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        timerEl.textContent =
            String(h).padStart(2, '0') + ':' +
            String(m).padStart(2, '0') + ':' +
            String(s).padStart(2, '0');
    }, 1000);
}

export function getSessionMinutes() {
    if (!sessionStartTime) return 0;
    return (Date.now() - sessionStartTime) / 60000;
}

export function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

// --- Quotes ---
export function startQuotes() {
    showNextQuote();
    setInterval(showNextQuote, 15000);
}

function showNextQuote() {
    const el = document.getElementById('quote-text');
    el.style.opacity = 0;
    setTimeout(() => {
        el.textContent = '« ' + QUOTES[currentQuoteIdx] + ' »';
        el.style.opacity = 1;
        currentQuoteIdx = (currentQuoteIdx + 1) % QUOTES.length;
    }, 600);
}

// --- Update HUD from server data ---
export function updateHUD(data) {
    document.getElementById('level-num').textContent = data.level;
    document.getElementById('xp-text').textContent = `${data.xpInLevel} / ${data.xpForNext} XP`;

    const pct = data.xpForNext > 0 ? (data.xpInLevel / data.xpForNext) * 100 : 0;
    document.getElementById('xp-bar-fill').style.width = pct + '%';

    document.getElementById('stat-sessions').textContent = data.totalSessions;

    const totalH = Math.floor(data.totalMinutes / 60);
    const totalM = Math.round(data.totalMinutes % 60);
    document.getElementById('stat-total-time').textContent =
        totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`;

    document.getElementById('stat-streak').textContent = data.currentStreak + '🔥';
    document.getElementById('stat-longest').textContent = Math.round(data.longestSessionMin) + 'm';

    // Notify app.js about level change
    if (_levelUpdater && data.level) _levelUpdater(data.level);
}

// --- Load initial stats ---
export async function loadStats() {
    try {
        const data = await fetchStats();
        updateHUD(data);
    } catch (e) {
        console.warn('Could not load stats:', e);
    }
}

// --- End session and save ---
export async function endSession() {
    const min = getSessionMinutes();
    if (min < 0.1) return; // Ignore very short sessions

    stopTimer();

    try {
        const data = await saveSession(min);
        updateHUD(data);

        // Show earned XP feedback
        const earnedXP = data.earnedXP || 0;
        showXPFeedback(earnedXP);

        // Flash HUD to show updated stats
        if (_flashHUD) _flashHUD();

        // Reset timer for next session
        sessionStartTime = Date.now();
        startTimer();
    } catch (e) {
        console.warn('Could not save session:', e);
    }
}

// --- Sync save (for beforeunload) ---
function saveSessionSync() {
    const min = getSessionMinutes();
    if (min < 0.1) return;

    // Use the hybrid saveSessionSync from api.js
    apiSaveSync(min);
}

// --- Auto-save on page close/refresh ---
window.addEventListener('beforeunload', () => {
    saveSessionSync();
});

// --- Reset all stats ---
export async function doReset() {
    if (!confirm('هل أنت متأكد من إعادة تعيين جميع الإحصائيات؟')) return;
    try {
        const data = await resetStats();
        updateHUD(data);

        // Flash HUD to show reset stats
        if (_flashHUD) _flashHUD();
    } catch (e) {
        console.warn('Could not reset stats:', e);
    }
}

// --- XP Feedback ---
function showXPFeedback(xp) {
    const el = document.createElement('div');
    el.textContent = `+${xp} XP`;
    el.style.cssText = `
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2.5rem;
        font-weight: 900;
        font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        z-index: 100;
        pointer-events: none;
        animation: xpFly 2s ease-out forwards;
    `;

    // Add animation keyframes if not present
    if (!document.getElementById('xp-fly-style')) {
        const style = document.createElement('style');
        style.id = 'xp-fly-style';
        style.textContent = `
            @keyframes xpFly {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                20% { opacity: 1; transform: translate(-50%, -60%) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -120%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}
