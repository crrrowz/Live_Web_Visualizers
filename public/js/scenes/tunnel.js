// scenes/tunnel.js — Warp Tunnel with glowing rings and shader particles
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let rings = [], innerRings = [], speedLines, tunnelGlow;
let currentLevel = 1;
let currentSpeed = 0;

const RING_COUNT = 50;
const TUNNEL_DEPTH = 120;
const SPEED_LINE_COUNT = 800;

// --- Glow texture for particles ---
function createGlowTexture(r, g, b) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, `rgba(${r},${g},${b},1.0)`);
    grad.addColorStop(0.2, `rgba(${r},${g},${b},0.7)`);
    grad.addColorStop(0.5, `rgba(${Math.floor(r*0.6)},${Math.floor(g*0.6)},${Math.floor(b*0.8)},0.2)`);
    grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// --- Ring glow texture (annular gradient) ---
function createRingTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    // Draw a glowing ring
    ctx.beginPath();
    ctx.arc(center, center, center * 0.85, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(100,180,255,0.8)';
    ctx.shadowColor = 'rgba(80,160,255,1)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 30;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(150,200,255,0.5)';
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// --- Custom speed-line shader (elongated streaks) ---
const lineVertexShader = `
    attribute float aSize;
    attribute float aSpeed;
    varying float vSpeed;
    varying vec3 vColor;
    void main() {
        vColor = color;
        vSpeed = aSpeed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (80.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const lineFragmentShader = `
    uniform sampler2D uTexture;
    varying float vSpeed;
    varying vec3 vColor;
    void main() {
        vec2 uv = gl_PointCoord;
        // Stretch vertically to create streak effect
        float streakY = abs(uv.y - 0.5) * 2.0;
        float streakX = abs(uv.x - 0.5) * 2.0;
        float streak = 1.0 - smoothstep(0.0, 0.3, streakX);
        streak *= 1.0 - smoothstep(0.0, 0.8 + vSpeed * 0.2, streakY);
        float glow = streak * (0.6 + vSpeed * 0.4);
        gl_FragColor = vec4(vColor * glow, glow * 0.7);
    }
`;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Warp Tunnel';

    const ringTexture = createRingTexture();

    // --- Outer geometric rings ---
    for (let i = 0; i < RING_COUNT; i++) {
        const sides = [6, 8, 5, 7, 4][i % 5];
        const radius = 3.5 + Math.sin(i * 0.3) * 0.8;
        const geo = new THREE.RingGeometry(radius - 0.06, radius + 0.06, sides);
        const hue = (i / RING_COUNT) * 0.4 + 0.45;
        const col = new THREE.Color().setHSL(hue, 1.0, 0.45);
        const mat = new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.position.z = -(i / RING_COUNT) * TUNNEL_DEPTH;
        ring.rotation.z = i * 0.12;
        ring.userData = { hue, idx: i };

        // Subtle glow sprite on every 4th ring only (performance)
        if (i % 4 === 0) {
            const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: ringTexture,
                color: col,
                transparent: true,
                opacity: 0.03,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            glowSprite.scale.set(radius * 1.2, radius * 1.2, 1);
            ring.add(glowSprite);
        }

        scene.add(ring);
        rings.push(ring);
    }

    // --- Inner energy rings ---
    for (let i = 0; i < 20; i++) {
        const geo = new THREE.RingGeometry(1.0, 1.12, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.65, 1.0, 0.5),
            transparent: true, opacity: 0.0,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.position.z = -(i / 20) * TUNNEL_DEPTH;
        scene.add(ring);
        innerRings.push(ring);
    }

    // --- Speed lines with custom shader ---
    const slGeo = new THREE.BufferGeometry();
    const slPos = new Float32Array(SPEED_LINE_COUNT * 3);
    const slCol = new Float32Array(SPEED_LINE_COUNT * 3);
    const slSizes = new Float32Array(SPEED_LINE_COUNT);
    const slSpeeds = new Float32Array(SPEED_LINE_COUNT);

    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 1.2 + Math.random() * 4.0;
        slPos[i * 3]     = Math.cos(angle) * r;
        slPos[i * 3 + 1] = Math.sin(angle) * r;
        slPos[i * 3 + 2] = (Math.random() - 0.5) * TUNNEL_DEPTH;

        // Color: blue-white to purple
        const hue = 0.55 + Math.random() * 0.15;
        const c = new THREE.Color().setHSL(hue, 0.7, 0.5 + Math.random() * 0.3);
        slCol[i * 3] = c.r; slCol[i * 3 + 1] = c.g; slCol[i * 3 + 2] = c.b;

        slSizes[i] = 0.8 + Math.random() * 1.2;
        slSpeeds[i] = 0.4 + Math.random() * 0.6;
    }

    slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3));
    slGeo.setAttribute('color', new THREE.BufferAttribute(slCol, 3));
    slGeo.setAttribute('aSize', new THREE.BufferAttribute(slSizes, 1));
    slGeo.setAttribute('aSpeed', new THREE.BufferAttribute(slSpeeds, 1));
    slGeo.userData = { speeds: slSpeeds };

    speedLines = new THREE.Points(slGeo, new THREE.ShaderMaterial({
        uniforms: { uTexture: { value: createGlowTexture(120, 180, 255) } },
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    scene.add(speedLines);

    // --- Central vanishing point glow ---
    const glowTex = createGlowTexture(150, 200, 255);
    const glowMat = new THREE.SpriteMaterial({
        map: glowTex, color: 0xaaddff,
        transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    tunnelGlow = new THREE.Sprite(glowMat);
    tunnelGlow.scale.set(3, 3, 1);
    tunnelGlow.position.z = -TUNNEL_DEPTH * 0.85;
    scene.add(tunnelGlow);
}

export function update(time, bass, rawBass, smoothBass) {
    const targetSpeed = 0.15 + bass * 2.0;
    currentSpeed += (targetSpeed - currentSpeed) * 0.07;

    // --- Rings ---
    rings.forEach((r, i) => {
        r.position.z += currentSpeed;
        if (r.position.z > 6) r.position.z -= TUNNEL_DEPTH;

        r.rotation.z += (0.001 + currentSpeed * 0.002) * (i % 2 === 0 ? 1 : -1);

        const normZ = 1.0 - Math.abs(r.position.z) / TUNNEL_DEPTH;
        r.material.opacity = normZ * (0.06 + bass * 0.12);

        const pulse = 1.0 + Math.sin(time * 4 + i * 0.2) * 0.04 + bass * 0.15;
        r.scale.setScalar(pulse);

        const hue = (r.userData.hue + bass * 0.1 + time * 0.015) % 1;
        r.material.color.setHSL(hue, 1.0, 0.4 + bass * 0.06);

        // Ring glow sprite
        const sprite = r.children[0];
        if (sprite) {
            sprite.material.opacity = normZ * (0.03 + bass * 0.05);
        }
    });

    // --- Inner rings ---
    innerRings.forEach(r => {
        r.position.z += currentSpeed * 0.7;
        if (r.position.z > 6) r.position.z -= TUNNEL_DEPTH;
        const normZ = 1.0 - Math.abs(r.position.z) / TUNNEL_DEPTH;
        r.material.opacity = bass * 0.2 * normZ;
        r.scale.setScalar(1.0 + bass * 0.25);
    });

    // --- Speed lines ---
    const slPos = speedLines.geometry.attributes.position.array;
    const slSpeeds = speedLines.geometry.userData.speeds;
    const half = TUNNEL_DEPTH / 2;
    for (let i = 0; i < slPos.length / 3; i++) {
        slPos[i * 3 + 2] += currentSpeed * slSpeeds[i];
        if (slPos[i * 3 + 2] > half) {
            slPos[i * 3 + 2] -= TUNNEL_DEPTH;
            const angle = Math.random() * Math.PI * 2;
            const r = 1.2 + Math.random() * 4.0;
            slPos[i * 3]     = Math.cos(angle) * r;
            slPos[i * 3 + 1] = Math.sin(angle) * r;
        }
    }
    speedLines.geometry.attributes.position.needsUpdate = true;

    // --- Central glow ---
    tunnelGlow.scale.setScalar(2 + bass * 3 + Math.sin(time * 2.5) * 0.3);
    tunnelGlow.material.opacity = 0.1 + bass * 0.12;

    return { bg: new THREE.Color(0.006, 0.003, 0.02), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.25);
    rings.forEach(r => {
        const hue = (r.userData.hue + lf) % 1;
        r.material.color.setHSL(hue, 1.0, 0.45 + lf * 0.3);
    });
    tunnelGlow.material.color.setHSL(0.6 + lf, 1.0, 0.55);
}

export function dispose(scene) {
    rings.forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
    innerRings.forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
    if (speedLines) { scene.remove(speedLines); speedLines.geometry.dispose(); speedLines.material.dispose(); }
    if (tunnelGlow) { scene.remove(tunnelGlow); tunnelGlow.material.dispose(); }
    rings = []; innerRings = []; speedLines = tunnelGlow = null; currentSpeed = 0;
}
