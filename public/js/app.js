// app.js — Main application with scene switching
import * as THREE from 'https://esm.sh/three@0.136.0';
import { EffectComposer } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

import CONFIG from './config.js';
import { drawWaveform } from './waveform.js';
import { startTimer, startQuotes, loadStats, endSession, doReset, setFlashHUD, setLevelUpdater } from './study.js';

// Scene modules
import * as MatterScene from './scenes/matter.js';
import * as SolarScene from './scenes/solar.js';
import * as DNAScene from './scenes/dna.js';
import * as GalaxyScene from './scenes/galaxy.js';
import * as NeuralScene from './scenes/neural.js';
import * as OceanScene from './scenes/ocean.js';
import * as TunnelScene from './scenes/tunnel.js';
import * as AuroraScene from './scenes/aurora.js';

const SCENES = [
    { name: 'Matter × Antimatter', module: MatterScene, camZ: 12 },
    { name: 'Solar System',        module: SolarScene,  camZ: 25 },
    { name: 'DNA Helix',           module: DNAScene,    camZ: 14 },
    { name: 'Galaxy',              module: GalaxyScene,  camZ: 18 },
    { name: 'Neural Network',      module: NeuralScene,  camZ: 15 },
    { name: 'Deep Ocean',          module: OceanScene,   camZ: 14 },
    { name: 'Warp Tunnel',         module: TunnelScene,  camZ: 8 },
    { name: 'Aurora Borealis',     module: AuroraScene,  camZ: 12 },
];
let activeSceneIdx = 0;

// ========================
// AUDIO
// ========================
let audioContext, analyser, dataArray, waveformArray;
let isAudioActive = false;
let bass = 0, smoothBass = 0;

// ========================
// CANVAS
// ========================
const waveCanvas = document.getElementById('waveCanvas');
const wCtx = waveCanvas.getContext('2d');

// ========================
// VOLUME BAR
// ========================
const volBar = document.getElementById('volume-bar');
const VOL_SEGMENTS = 40;
for (let i = 0; i < VOL_SEGMENTS; i++) {
    const s = document.createElement('div');
    s.className = 'vol-segment';
    volBar.appendChild(s);
}

// ========================
// THREE.JS
// ========================
let scene, camera, renderer, composer, bloomPass;
let audioStarted = false;
let currentLevel = 1;
let spacePaused = false;

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
    camera.position.z = SCENES[activeSceneIdx].camZ;

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight), 1.5, 0.4, 0.85
    );
    bloomPass.threshold = CONFIG.bloomThreshold;
    bloomPass.strength = CONFIG.bloomStrength;
    bloomPass.radius = CONFIG.bloomRadius;

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloomPass);

    // Create initial scene
    SCENES[activeSceneIdx].module.create(scene);

    // --- HUD Flash ---
    const studyHud = document.getElementById('study-hud');
    let hudTimer = null;

    function flashHUD() {
        studyHud.style.display = 'block';
        studyHud.style.opacity = '1';
        if (hudTimer) clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
            studyHud.style.opacity = '0';
        }, CONFIG.hudShowDurationMs);
    }

    setFlashHUD(flashHUD);
    setLevelUpdater((level) => {
        currentLevel = level;
        SCENES[activeSceneIdx].module.updateLevel(level);
        // Logarithmic bloom scaling
        bloomPass.strength = CONFIG.bloomStrength + CONFIG.levelFactor(level, CONFIG.levelBloomMax);
        bloomPass.radius = CONFIG.bloomRadius + CONFIG.levelFactor(level, 0.3);
    });

    // Scene switch button
    document.getElementById('scene-toggle').addEventListener('click', () => switchScene());

    // --- Auto-start ---
    function onFirstInteraction() {
        if (audioStarted) return;
        audioStarted = true;
        initAudio();

        const prompt = document.getElementById('tap-prompt');
        if (prompt) {
            prompt.style.opacity = 0;
            setTimeout(() => prompt.remove(), 1000);
        }

        document.getElementById('top-bar').style.display = 'flex';
        document.getElementById('quote-box').style.display = 'block';
        volBar.style.display = 'flex';
        document.getElementById('controls-hint').style.display = 'flex';
        document.getElementById('scene-nav').style.display = 'block';

        startTimer();
        startQuotes();
        loadStats();
        flashHUD();

        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
    }
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    // --- Keyboard ---
    let spaceDownTime = 0;
    let spaceIsLongPress = false;

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            spaceDownTime = Date.now();
            spaceIsLongPress = false;
            setTimeout(() => {
                if (spaceDownTime > 0 && (Date.now() - spaceDownTime) >= CONFIG.longPressThresholdMs) {
                    spaceIsLongPress = true;
                    spacePaused = true;
                    studyHud.style.display = 'block';
                    studyHud.style.opacity = '1';
                    if (hudTimer) clearTimeout(hudTimer);
                }
            }, CONFIG.longPressThresholdMs);
        }
        if (e.code === 'KeyS') endSession();
        if (e.code === 'KeyR') doReset();
        if (e.code === 'KeyT') switchScene();
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (spaceIsLongPress) {
                spacePaused = false;
                studyHud.style.opacity = '0';
            } else {
                document.body.classList.toggle('inverted');
            }
            spaceDownTime = 0;
            spaceIsLongPress = false;
        }
    });

    window.addEventListener('resize', onResize);
    onResize();
}

// ========================
// SCENE SWITCHING
// ========================
function switchScene() {
    SCENES[activeSceneIdx].module.dispose(scene);
    activeSceneIdx = (activeSceneIdx + 1) % SCENES.length;
    const next = SCENES[activeSceneIdx];
    next.module.create(scene);
    next.module.updateLevel(currentLevel);

    // Full camera reset
    camera.position.set(0, 0, next.camZ);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    const nextIdx = (activeSceneIdx + 1) % SCENES.length;
    document.getElementById('scene-toggle').textContent = '🔄 ' + SCENES[nextIdx].name;
}

function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    waveCanvas.width = innerWidth;
    waveCanvas.height = innerHeight;
}

// ========================
// AUDIO INIT WITH COMPRESSOR
// ========================
async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);

        // Gain
        const gainNode = audioContext.createGain();
        gainNode.gain.value = CONFIG.micGain;
        source.connect(gainNode);

        // DynamicsCompressor — normalizes volume regardless of mic distance
        let lastNode = gainNode;
        if (CONFIG.useCompressor) {
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(CONFIG.compressorThreshold, audioContext.currentTime);
            compressor.knee.setValueAtTime(CONFIG.compressorKnee, audioContext.currentTime);
            compressor.ratio.setValueAtTime(CONFIG.compressorRatio, audioContext.currentTime);
            compressor.attack.setValueAtTime(CONFIG.compressorAttack, audioContext.currentTime);
            compressor.release.setValueAtTime(CONFIG.compressorRelease, audioContext.currentTime);
            gainNode.connect(compressor);
            lastNode = compressor;
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = CONFIG.analyserSmoothing;
        analyser.minDecibels = CONFIG.minDecibels;
        analyser.maxDecibels = CONFIG.maxDecibels;
        lastNode.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        waveformArray = new Uint8Array(analyser.fftSize);
        isAudioActive = true;
    } catch (e) {
        alert('يرجى السماح بالوصول للميكروفون!');
    }
}

function updateVolumeBar() {
    if (!isAudioActive) return;
    const segments = volBar.children;
    for (let i = 0; i < VOL_SEGMENTS; i++) {
        const idx = Math.floor((i / VOL_SEGMENTS) * dataArray.length);
        const val = dataArray[idx] / 255;
        segments[i].style.height = (3 + val * 25) + 'px';
    }
}

// ========================
// MAIN LOOP
// ========================
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * CONFIG.shaderTimeSpeed;
    let rawBass = 0;

    if (isAudioActive && !spacePaused) {
        analyser.getByteFrequencyData(dataArray);

        // RMS-based bass calculation (more stable than simple average)
        let sumSq = 0;
        for (let i = 0; i < CONFIG.frequencyBins; i++) {
            const v = dataArray[i] / 255;
            sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / CONFIG.frequencyBins);
        rawBass = Math.min(rms * CONFIG.bassMultiplier, 1.0);
        bass = Math.pow(rawBass, CONFIG.bassPowerCurve);
        smoothBass += (rawBass - smoothBass) * CONFIG.smoothingSpeed;
    }

    // Update active scene
    const activeModule = SCENES[activeSceneIdx].module;
    const result = activeModule.update(time, bass, rawBass, smoothBass, camera);

    if (result.collision) {
        activeModule.onCollision(bass);
        camera.position.x += (Math.random() - 0.5) * bass * CONFIG.cameraShakeIntensity;
        camera.position.y += (Math.random() - 0.5) * bass * CONFIG.cameraShakeIntensity;
    } else if (!result.managesCamera) {
        // Only reset camera for scenes that don't control it themselves
        camera.position.x += (0 - camera.position.x) * 0.1;
        camera.position.y += (0 - camera.position.y) * 0.1;
    }

    scene.background = result.bg;

    // 2D overlays
    if (isAudioActive && !spacePaused) {
        if (CONFIG.showWaveform) {
            drawWaveform(wCtx, waveCanvas.width, waveCanvas.height, analyser, waveformArray, dataArray, smoothBass);
        } else {
            wCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
        }
        updateVolumeBar();
    } else if (spacePaused) {
        wCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    }

    composer.render();
}
