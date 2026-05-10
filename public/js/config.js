// config.js — All tunable parameters in one place
// Change any value here and refresh the page to see the effect

const CONFIG = {

    // ============ AUDIO SENSITIVITY ============
    micGain: 0.5,               // Microphone amplification (1.0 = normal, 5.0 = very sensitive)
    useCompressor: true,        // Auto-normalize volume (fixes close/far mic issue)
    compressorThreshold: -30,   // dB above which compression starts
    compressorKnee: 20,         // Smoothness of compression curve
    compressorRatio: 8,         // Compression ratio (higher = more normalization)
    compressorAttack: 0.003,    // How fast compressor reacts (seconds)
    compressorRelease: 0.15,    // How fast compressor releases (seconds)

    bassMultiplier: 2.5,        // Signal amplifier for bass detection
    bassPowerCurve: 1.2,        // Power curve (lower = reacts to soft sounds)
    smoothingSpeed: 0.1,        // Visual follow speed (0.01=slow, 0.3=instant)
    frequencyBins: 20,          // Frequency bins to analyze (6=bass, 30=full voice)
    analyserSmoothing: 0.65,    // Analyser time smoothing (0=raw, 0.9=smooth)
    minDecibels: -90,           // Min detectable volume (dB)
    maxDecibels: -10,           // Max volume (dB)

    // ============ 3D OBJECTS ============
    objectBaseScale: 1.0,       // Base scale of 3D objects
    shaderTimeSpeed: 0.0004,    // Speed of organic mesh deformation

    // ============ LEVEL SCALING (Logarithmic) ============
    // These use log2(level+1) so growth slows at higher levels:
    // Level 1=1.0x, Level 5=1.15x, Level 10=1.22x, Level 20=1.28x, Level 50=1.35x
    levelScaleMax: 0.4,         // Max extra scale from leveling (log curve)
    levelBloomMax: 0.8,         // Max extra bloom from leveling
    levelParticleMax: 0.12,     // Max extra particle size
    levelRotationMax: 0.5,      // Max extra rotation speed

    // ============ SHADER COLORS ============
    matterDarkColor: [0.08, 0.02, 0.35],   // Darkest shade (cyan/blue)
    matterBrightColor: [0.0, 0.9, 1.0],    // Brightest shade
    antiDarkColor: [0.35, 0.02, 0.25],      // Darkest shade (pink)
    antiBrightColor: [1.0, 0.0, 0.45],      // Brightest shade
    colorBoostOnBass: 0.12,                  // Extra brightness on bass (lower = less white)

    // ============ ROTATION ============
    baseRotationSpeed: 0.2,     // Minimum rotation speed
    bassRotationBoost: 1.5,     // Bass rotation multiplier
    rotationMultiplierY: 0.004,
    rotationMultiplierZ: 0.006,

    // ============ ATTRACTION / COLLISION ============
    maxDistance: 6.0,
    attractionMultiplier: 1.2,
    attractionSmoothing: 0.03,
    collisionThreshold: 1.5,
    cameraShakeIntensity: 0.15,

    // ============ BLOOM / GLOW ============
    bloomStrength: 1.5,         // Base bloom intensity
    bloomRadius: 0.5,
    bloomThreshold: 0.1,

    // ============ PARTICLES ============
    particleCount: 2000,
    particleBaseSize: 0.05,
    particleSpread: 20,

    // ============ WAVEFORM 2D ============
    showWaveform: false,         // Show the circular audio waveform overlay
    waveformBaseRadius: 0.22,
    waveformAmplitude: 40,
    waveformBassBoost: 80,

    // ============ STUDY ============
    quoteIntervalMs: 15000,
    xpPerMinute: 10,
    hudShowDurationMs: 3000,
    longPressThresholdMs: 250,

    // ============ BACKGROUND ============
    bgColor: [0.027, 0.027, 0.05],
};

// --- Level scaling utility ---
// Returns a value between 0 and maxVal using log2 curve
// Level 1 → ~0.15*max, Level 10 → ~0.53*max, Level 50 → ~0.83*max
CONFIG.levelFactor = function (level, maxVal) {
    return maxVal * (Math.log2(level + 1) / Math.log2(52));
};

export default CONFIG;
