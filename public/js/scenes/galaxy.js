// scenes/galaxy.js — Photorealistic Galaxy with custom shaders
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let galaxyGroup, galaxyPoints, coreGlow, corePulse, nebulaCloud, farStars;
let currentLevel = 1;

let orbitAngle = 0;
let orbitTilt = 0.3;
let orbitRadius = 20;
let targetTilt = 0.3;
let targetRadius = 20;

const ARM_COUNT = 5;
const STAR_COUNT = 18000;
const FAR_STAR_COUNT = 4000;
const GALAXY_RADIUS = 16;

// --- Generate soft glow texture from canvas ---
function createStarTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    gradient.addColorStop(0.15, 'rgba(255,240,220,0.8)');
    gradient.addColorStop(0.4, 'rgba(200,180,255,0.3)');
    gradient.addColorStop(0.7, 'rgba(100,120,255,0.05)');
    gradient.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

function createCoreTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0.0, 'rgba(255,230,150,1.0)');
    gradient.addColorStop(0.1, 'rgba(255,200,100,0.9)');
    gradient.addColorStop(0.3, 'rgba(255,150,50,0.4)');
    gradient.addColorStop(0.6, 'rgba(200,100,50,0.1)');
    gradient.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// --- Custom shader for per-particle size & color ---
const starVertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const starFragmentShader = `
    uniform sampler2D uTexture;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vec4 texColor = texture2D(uTexture, gl_PointCoord);
        gl_FragColor = vec4(vColor * texColor.rgb, texColor.a * vAlpha);
    }
`;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Galaxy';

    galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);

    const starTexture = createStarTexture();

    // --- Galaxy stars with custom shader ---
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const alphas = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
        const arm = i % ARM_COUNT;
        const armAngle = (arm / ARM_COUNT) * Math.PI * 2;

        // Power distribution — more stars near center
        const dist = Math.pow(Math.random(), 0.5) * GALAXY_RADIUS;

        // Logarithmic spiral
        const spiralAngle = dist * 1.1 + armAngle;

        // Spread increases with distance
        const armWidth = 0.3 + dist * 0.12;
        const spread = (Math.random() - 0.5) * armWidth;
        const perpAngle = spiralAngle + Math.PI / 2;
        const sx = Math.cos(perpAngle) * spread;
        const sz = Math.sin(perpAngle) * spread;

        // Height — thin disk
        const heightSpread = (Math.random() - 0.5) * (0.1 + dist * 0.02);

        positions[i * 3]     = Math.cos(spiralAngle) * dist + sx;
        positions[i * 3 + 1] = heightSpread;
        positions[i * 3 + 2] = Math.sin(spiralAngle) * dist + sz;

        // Color: warm orange core → cool blue edges
        const t = dist / GALAXY_RADIUS;
        let hue, sat, light;
        if (t < 0.2) {
            hue = 0.08 + Math.random() * 0.04;   // Orange-yellow
            sat = 0.9;
            light = 0.6 + Math.random() * 0.3;
        } else if (t < 0.5) {
            hue = 0.1 + t * 0.8 + Math.random() * 0.1;  // Transition
            sat = 0.7 + Math.random() * 0.2;
            light = 0.4 + Math.random() * 0.3;
        } else {
            hue = 0.55 + Math.random() * 0.15;   // Blue-white
            sat = 0.5 + Math.random() * 0.3;
            light = 0.4 + Math.random() * 0.35;
        }
        const c = new THREE.Color().setHSL(hue, sat, light);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;

        // Varied sizes — brighter near center
        sizes[i] = (0.8 + Math.random() * 1.5) * (1.0 - t * 0.4);
        alphas[i] = 0.4 + Math.random() * 0.6;
    }

    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    gGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    gGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: starTexture }
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    galaxyPoints = new THREE.Points(gGeo, starMaterial);
    galaxyGroup.add(galaxyPoints);

    // --- Galactic core (sprite-based glow) ---
    const coreTexture = createCoreTexture();
    const coreSpriteMat = new THREE.SpriteMaterial({
        map: coreTexture,
        color: 0xffcc55,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    coreGlow = new THREE.Sprite(coreSpriteMat);
    coreGlow.scale.set(4, 4, 1);
    galaxyGroup.add(coreGlow);

    // Outer core halo
    const haloMat = new THREE.SpriteMaterial({
        map: coreTexture,
        color: 0xff7733,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    corePulse = new THREE.Sprite(haloMat);
    corePulse.scale.set(8, 8, 1);
    galaxyGroup.add(corePulse);

    // --- Nebula dust (soft large blobs) ---
    const nebulaTexture = createStarTexture();
    const nCount = 2000;
    const nGeo = new THREE.BufferGeometry();
    const nPos = new Float32Array(nCount * 3);
    const nCol = new Float32Array(nCount * 3);
    for (let i = 0; i < nCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 14;
        nPos[i * 3]     = Math.cos(a) * r + (Math.random() - 0.5) * 3;
        nPos[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
        nPos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 3;
        const nc = new THREE.Color().setHSL(0.6 + Math.random() * 0.25, 0.4, 0.2 + Math.random() * 0.1);
        nCol[i * 3] = nc.r; nCol[i * 3 + 1] = nc.g; nCol[i * 3 + 2] = nc.b;
    }
    nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
    nebulaCloud = new THREE.Points(nGeo, new THREE.PointsMaterial({
        map: nebulaTexture, size: 1.2, vertexColors: true,
        transparent: true, opacity: 0.04,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    galaxyGroup.add(nebulaCloud);

    // --- Far background stars ---
    const fsGeo = new THREE.BufferGeometry();
    const fsPos = new Float32Array(FAR_STAR_COUNT * 3);
    for (let i = 0; i < FAR_STAR_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 70 + Math.random() * 40;
        fsPos[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
        fsPos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
        fsPos[i * 3 + 2] = Math.cos(phi) * r;
    }
    fsGeo.setAttribute('position', new THREE.BufferAttribute(fsPos, 3));
    farStars = new THREE.Points(fsGeo, new THREE.PointsMaterial({
        map: createStarTexture(), color: 0xddeeff, size: 0.3,
        transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    scene.add(farStars);
}

export function update(time, bass, rawBass, smoothBass, camera) {
    const t = time;

    // Galaxy slow self-rotation
    galaxyGroup.rotation.y += 0.0005 + bass * 0.002;

    // Camera orbit
    orbitAngle += 0.0012 + bass * 0.004;
    targetTilt = 0.25 + Math.sin(t * 0.25) * 0.2 + smoothBass * 0.35;
    orbitTilt += (targetTilt - orbitTilt) * 0.025;
    targetRadius = 20 + smoothBass * 6;
    orbitRadius += (targetRadius - orbitRadius) * 0.03;

    const camX = Math.cos(orbitAngle) * Math.cos(orbitTilt) * orbitRadius;
    const camY = Math.sin(orbitTilt) * orbitRadius;
    const camZ = Math.sin(orbitAngle) * Math.cos(orbitTilt) * orbitRadius;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(galaxyGroup.position);

    // Infinite fly-through: push stars outward on bass
    if (bass > 0.05) {
        const starPos = galaxyPoints.geometry.attributes.position.array;
        for (let i = 0; i < starPos.length; i += 3) {
            const dx = starPos[i], dy = starPos[i + 1], dz = starPos[i + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 0.1) {
                const push = bass * 0.015 * (1.0 + dist * 0.03);
                starPos[i]     += (dx / dist) * push;
                starPos[i + 1] += (dy / dist) * push * 0.2;
                starPos[i + 2] += (dz / dist) * push;
            }
            if (dist > GALAXY_RADIUS + 2) {
                const arm = Math.floor(Math.random() * ARM_COUNT);
                const aa = (arm / ARM_COUNT) * Math.PI * 2;
                const nd = Math.pow(Math.random(), 0.5) * GALAXY_RADIUS * 0.4;
                const sa = nd * 1.1 + aa;
                starPos[i]     = Math.cos(sa) * nd + (Math.random() - 0.5) * 0.3;
                starPos[i + 1] = (Math.random() - 0.5) * 0.1;
                starPos[i + 2] = Math.sin(sa) * nd + (Math.random() - 0.5) * 0.3;
            }
        }
        galaxyPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Core animation
    const coreScale = 3.5 + bass * 2.0 + Math.sin(t * 2.5) * 0.3;
    coreGlow.scale.set(coreScale, coreScale, 1);
    coreGlow.material.opacity = 0.6 + bass * 0.2;
    const haloScale = 6 + bass * 3;
    corePulse.scale.set(haloScale, haloScale, 1);
    corePulse.material.opacity = 0.12 + bass * 0.08;

    // Nebula follows galaxy rotation
    nebulaCloud.rotation.y = galaxyGroup.rotation.y * 0.5;
    nebulaCloud.material.opacity = 0.03 + bass * 0.03;

    // Far stars — subtle parallax
    farStars.rotation.y = -orbitAngle * 0.015;
    farStars.rotation.x = -orbitTilt * 0.04;

    return { bg: new THREE.Color(0.003, 0.003, 0.01), collision: false, managesCamera: true };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.2);
    coreGlow.material.color.setHSL(0.1 + lf * 0.3, 1.0, 0.55 + lf * 0.1);
    nebulaCloud.material.opacity = 0.04 + CONFIG.levelFactor(level, 0.025);
}

export function dispose(scene) {
    if (galaxyGroup) scene.remove(galaxyGroup);
    if (farStars) { scene.remove(farStars); farStars.geometry.dispose(); farStars.material.dispose(); }
    galaxyGroup = galaxyPoints = coreGlow = corePulse = nebulaCloud = farStars = null;
    orbitAngle = 0; orbitTilt = 0.3; orbitRadius = 20; targetTilt = 0.3; targetRadius = 20;
}
