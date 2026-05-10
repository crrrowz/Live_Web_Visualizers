// scenes/dna.js — Photorealistic DNA Double Helix
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let helixGroup, strand1Nodes = [], strand2Nodes = [], basePairs = [];
let backbones = [], particles;
let currentLevel = 1;

const NODES_PER_STRAND = 80;
const HELIX_RADIUS = 1.8;
const HELIX_HEIGHT = 24;
const TURNS = 4;

// --- Glow texture ---
function createGlowTexture(r, g, b) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0.0, `rgba(${r},${g},${b},1.0)`);
    grad.addColorStop(0.15, `rgba(${r},${g},${b},0.85)`);
    grad.addColorStop(0.4, `rgba(${Math.floor(r*0.7)},${Math.floor(g*0.7)},${Math.floor(b*0.8)},0.3)`);
    grad.addColorStop(0.7, `rgba(${Math.floor(r*0.3)},${Math.floor(g*0.3)},${Math.floor(b*0.5)},0.06)`);
    grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// --- Node shader (per-particle glow spheres) ---
const nodeVertexShader = `
    attribute float aSize;
    varying vec3 vColor;
    void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (120.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;
const nodeFragmentShader = `
    uniform sampler2D uTexture;
    varying vec3 vColor;
    void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        gl_FragColor = vec4(vColor * tex.rgb * 1.5, tex.a * 0.9);
    }
`;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'DNA Helix';
    helixGroup = new THREE.Group();
    scene.add(helixGroup);

    // --- Strand nodes as shader particles ---
    const s1Pos = [], s1Col = [], s1Size = [];
    const s2Pos = [], s2Col = [], s2Size = [];

    for (let i = 0; i < NODES_PER_STRAND; i++) {
        const t = i / NODES_PER_STRAND;
        const y = (t - 0.5) * HELIX_HEIGHT;
        const angle = t * Math.PI * 2 * TURNS;

        // Strand 1 positions
        const x1 = Math.cos(angle) * HELIX_RADIUS;
        const z1 = Math.sin(angle) * HELIX_RADIUS;
        s1Pos.push(x1, y, z1);
        const c1 = new THREE.Color().setHSL(0.52 + t * 0.05, 0.9, 0.55);
        s1Col.push(c1.r, c1.g, c1.b);
        s1Size.push(2.0 + Math.sin(t * Math.PI * 8) * 0.5);

        // Strand 2 positions (offset by PI)
        const x2 = Math.cos(angle + Math.PI) * HELIX_RADIUS;
        const z2 = Math.sin(angle + Math.PI) * HELIX_RADIUS;
        s2Pos.push(x2, y, z2);
        const c2 = new THREE.Color().setHSL(0.85 + t * 0.03, 0.9, 0.55);
        s2Col.push(c2.r, c2.g, c2.b);
        s2Size.push(2.0 + Math.cos(t * Math.PI * 8) * 0.5);
    }

    // Strand 1 particles
    const s1Geo = new THREE.BufferGeometry();
    s1Geo.setAttribute('position', new THREE.Float32BufferAttribute(s1Pos, 3));
    s1Geo.setAttribute('color', new THREE.Float32BufferAttribute(s1Col, 3));
    s1Geo.setAttribute('aSize', new THREE.Float32BufferAttribute(s1Size, 1));
    const s1Points = new THREE.Points(s1Geo, new THREE.ShaderMaterial({
        uniforms: { uTexture: { value: createGlowTexture(0, 220, 255) } },
        vertexShader: nodeVertexShader, fragmentShader: nodeFragmentShader,
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    helixGroup.add(s1Points);
    strand1Nodes.push(s1Points);

    // Strand 2 particles
    const s2Geo = new THREE.BufferGeometry();
    s2Geo.setAttribute('position', new THREE.Float32BufferAttribute(s2Pos, 3));
    s2Geo.setAttribute('color', new THREE.Float32BufferAttribute(s2Col, 3));
    s2Geo.setAttribute('aSize', new THREE.Float32BufferAttribute(s2Size, 1));
    const s2Points = new THREE.Points(s2Geo, new THREE.ShaderMaterial({
        uniforms: { uTexture: { value: createGlowTexture(255, 80, 200) } },
        vertexShader: nodeVertexShader, fragmentShader: nodeFragmentShader,
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    helixGroup.add(s2Points);
    strand2Nodes.push(s2Points);

    // --- Glowing backbone tubes ---
    const tubeMaterial1 = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.52, 0.7, 0.35),
        transparent: true, opacity: 0.25
    });
    const tubeMaterial2 = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.85, 0.7, 0.35),
        transparent: true, opacity: 0.25
    });

    // Build backbone as a series of connected cylinders
    for (let i = 1; i < NODES_PER_STRAND; i++) {
        const idx = i * 3;
        const pidx = (i - 1) * 3;

        // Strand 1 backbone
        addBone(s1Pos[pidx], s1Pos[pidx+1], s1Pos[pidx+2],
                s1Pos[idx], s1Pos[idx+1], s1Pos[idx+2],
                tubeMaterial1, helixGroup);

        // Strand 2 backbone
        addBone(s2Pos[pidx], s2Pos[pidx+1], s2Pos[pidx+2],
                s2Pos[idx], s2Pos[idx+1], s2Pos[idx+2],
                tubeMaterial2, helixGroup);
    }

    // --- Base pairs with glow ---
    const pairTexture = createGlowTexture(255, 220, 100);
    const pairColors = [
        { h1: 0.12, h2: 0.0 },   // A-T: Gold → Red
        { h1: 0.5,  h2: 0.85 },  // G-C: Cyan → Pink
    ];

    for (let i = 0; i < NODES_PER_STRAND; i += 4) {
        if (i === 0) continue;
        const t = i / NODES_PER_STRAND;
        const y = (t - 0.5) * HELIX_HEIGHT;
        const angle = t * Math.PI * 2 * TURNS;
        const colorPair = pairColors[Math.floor(i / 4) % 2];

        // Glowing bar between strands
        const x1 = Math.cos(angle) * HELIX_RADIUS;
        const z1 = Math.sin(angle) * HELIX_RADIUS;
        const x2 = Math.cos(angle + Math.PI) * HELIX_RADIUS;
        const z2 = Math.sin(angle + Math.PI) * HELIX_RADIUS;

        const barLen = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
        const barGeo = new THREE.CylinderGeometry(0.04, 0.04, barLen, 6);
        const barMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(colorPair.h1, 0.9, 0.5),
            transparent: true, opacity: 0.4
        });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set((x1+x2)/2, y, (z1+z2)/2);
        bar.rotation.z = Math.PI / 2;
        bar.rotation.y = angle;
        helixGroup.add(bar);

        // Glow sprite at center of pair
        const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: pairTexture,
            color: new THREE.Color().setHSL(colorPair.h1, 1.0, 0.5),
            transparent: true, opacity: 0.0,
            blending: THREE.AdditiveBlending
        }));
        glowSprite.scale.set(0.8, 0.8, 1);
        glowSprite.position.set((x1+x2)/2, y, (z1+z2)/2);
        helixGroup.add(glowSprite);
        basePairs.push({ bar, glow: glowSprite, pairIdx: Math.floor(i/4) });
    }

    // --- Background particles ---
    const pGeo = new THREE.BufferGeometry();
    const pCount = 2000;
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
        pPos[i*3] = (Math.random()-0.5) * 30;
        pPos[i*3+1] = (Math.random()-0.5) * 30;
        pPos[i*3+2] = (Math.random()-0.5) * 20;
        const c = new THREE.Color().setHSL(0.5 + Math.random()*0.3, 0.6, 0.4 + Math.random()*0.2);
        pCol[i*3] = c.r; pCol[i*3+1] = c.g; pCol[i*3+2] = c.b;
    }
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.Float32BufferAttribute(pCol, 3));
    particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
        map: createGlowTexture(100, 200, 255), size: 0.3,
        vertexColors: true, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(particles);
}

function addBone(x1, y1, z1, x2, y2, z2, material, group) {
    const dx = x2-x1, dy = y2-y1, dz = z2-z1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.001) return;
    const geo = new THREE.CylinderGeometry(0.035, 0.035, len, 4);
    const bone = new THREE.Mesh(geo, material);
    bone.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(bone);
    backbones.push(bone);
}

export function update(time, bass, rawBass, smoothBass) {
    helixGroup.rotation.y += 0.003 + bass * 0.01;

    // Base pairs glow with voice
    basePairs.forEach((bp, i) => {
        const wave = Math.sin(time * 6 + i * 0.5) * 0.5 + 0.5;
        bp.bar.material.opacity = 0.2 + bass * 0.4 * wave;
        bp.glow.material.opacity = bass * 0.25 * wave;
        bp.glow.scale.setScalar(0.6 + bass * 0.8);
    });

    // Backbones glow slightly
    backbones.forEach(b => {
        b.material.opacity = 0.15 + bass * 0.15;
    });

    // Particles drift
    particles.rotation.y += 0.0004;
    particles.material.opacity = 0.08 + smoothBass * 0.15;

    const bg = CONFIG.bgColor;
    return { bg: new THREE.Color(bg[0], bg[1], bg[2]), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.2);
    const s = 1.0 + CONFIG.levelFactor(level, CONFIG.levelScaleMax);
    helixGroup.scale.setScalar(s);
    particles.material.size = 0.3 + CONFIG.levelFactor(level, 0.15);
}

export function dispose(scene) {
    if (helixGroup) scene.remove(helixGroup);
    if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); }
    helixGroup = null; particles = null;
    strand1Nodes = []; strand2Nodes = []; basePairs = []; backbones = [];
}
