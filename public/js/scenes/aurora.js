// scenes/aurora.js — Aurora Borealis with flowing ribbon curtains
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let ribbons = [], stars, mountains;
let currentLevel = 1;

const RIBBON_COUNT = 12;
const RIBBON_POINTS = 120;
const RIBBON_HEIGHT = 10;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Aurora Borealis';

    // --- Create ribbon curtains ---
    // Each ribbon is a tall, thin mesh made of quads with per-vertex color
    for (let r = 0; r < RIBBON_COUNT; r++) {
        const vertices = [];
        const colors = [];
        const indices = [];
        const uvs = [];

        const baseZ = -8 - r * 1.8;
        const baseX = (r - RIBBON_COUNT / 2) * 0.8;
        const hueBase = [0.30, 0.35, 0.28, 0.40, 0.33, 0.55, 0.32, 0.45, 0.29, 0.38, 0.50, 0.36][r % 12];

        for (let i = 0; i < RIBBON_POINTS; i++) {
            const t = i / (RIBBON_POINTS - 1);
            const x = baseX + (t - 0.5) * 24;

            // Bottom vertex
            vertices.push(x, 2, baseZ);
            // Top vertex
            vertices.push(x, 2 + RIBBON_HEIGHT, baseZ);

            // Vertical gradient: bright green at bottom → transparent purple at top
            const bottomHue = hueBase;
            const topHue = hueBase + 0.15;
            const cBottom = new THREE.Color().setHSL(bottomHue, 1.0, 0.45);
            const cTop = new THREE.Color().setHSL(topHue, 0.8, 0.3);

            // Horizontal brightness variation
            const edgeFade = Math.sin(t * Math.PI); // Fade at edges
            colors.push(cBottom.r * edgeFade, cBottom.g * edgeFade, cBottom.b * edgeFade);
            colors.push(cTop.r * edgeFade * 0.3, cTop.g * edgeFade * 0.3, cTop.b * edgeFade * 0.3);

            uvs.push(t, 0);
            uvs.push(t, 1);

            // Create quads
            if (i < RIBBON_POINTS - 1) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);

        const mat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.12 + (r % 3) * 0.03,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const ribbon = new THREE.Mesh(geo, mat);
        ribbon.userData = {
            hueBase,
            phase: r * 0.7,
            layer: r,
            baseZ
        };
        scene.add(ribbon);
        ribbons.push(ribbon);
    }

    // --- Dense starfield ---
    const sCount = 4000;
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(sCount * 3);
    for (let i = 0; i < sCount; i++) {
        sPos[i * 3]     = (Math.random() - 0.5) * 60;
        sPos[i * 3 + 1] = Math.random() * 20 + 2;
        sPos[i * 3 + 2] = -5 - Math.random() * 40;
    }
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    stars = new THREE.Points(sGeo, new THREE.PointsMaterial({
        color: 0xddeeff, size: 0.04, transparent: true, opacity: 0.65
    }));
    scene.add(stars);

    // --- Mountain silhouette ---
    const mShape = new THREE.Shape();
    mShape.moveTo(-30, 0);
    const peaks = [
        [-25,1],[-22,3],[-18,1.5],[-14,4.5],[-10,2],[-7,5.8],[-3,3],
        [0,6.5],[3,4],[6,7],[9,3.5],[13,5],[17,2],[21,4],[25,1.5],[30,0]
    ];
    peaks.forEach(([x, y]) => mShape.lineTo(x, y));
    mShape.lineTo(-30, 0);
    const mGeo = new THREE.ShapeGeometry(mShape);
    mountains = new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({ color: 0x030810, side: THREE.DoubleSide }));
    mountains.position.set(0, -1, -15);
    scene.add(mountains);

    // Ground
    const gGeo = new THREE.PlaneGeometry(70, 30);
    const ground = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ color: 0x020508 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);
}

export function update(time, bass, rawBass, smoothBass) {
    const t = time * 2;

    // --- Deform each ribbon's vertices to create flowing curtain ---
    ribbons.forEach((ribbon, rIdx) => {
        const pos = ribbon.geometry.attributes.position;
        const col = ribbon.geometry.attributes.color;
        const phase = ribbon.userData.phase;
        const hueBase = ribbon.userData.hueBase;

        for (let i = 0; i < RIBBON_POINTS; i++) {
            const frac = i / (RIBBON_POINTS - 1);
            const bIdx = i * 2;     // Bottom vertex
            const tIdx = i * 2 + 1; // Top vertex

            const x = pos.getX(bIdx);

            // Multi-layered wave for natural movement
            const w1 = Math.sin(x * 0.15 + t + phase) * 2.0;
            const w2 = Math.sin(x * 0.4 + t * 1.6 + phase * 2) * 0.8;
            const w3 = Math.sin(x * 0.07 + t * 0.4) * 3.0;
            const bassWave = Math.sin(x * 0.12 + t * 2.5) * bass * 1.8;
            const zOffset = w1 + w2 + w3 + bassWave;

            // Move Z for wave effect
            pos.setZ(bIdx, ribbon.userData.baseZ + zOffset);
            pos.setZ(tIdx, ribbon.userData.baseZ + zOffset * 0.7);

            // Top vertex height variation
            const heightVar = Math.sin(x * 0.2 + t * 0.8 + phase) * 2.0 + bass * 1.2;
            pos.setY(tIdx, 2 + RIBBON_HEIGHT + heightVar);

            // Dynamic color: brighten with bass, shift hue
            const edgeFade = Math.sin(frac * Math.PI);
            const brightness = edgeFade * (0.35 + bass * 0.3 + Math.sin(t * 0.5 + x * 0.1) * 0.1);

            const hShift = Math.sin(t * 0.3 + rIdx * 0.5) * 0.04;
            const cBot = new THREE.Color().setHSL((hueBase + hShift) % 1, 1.0, 0.3 + bass * 0.1);
            const cTop = new THREE.Color().setHSL((hueBase + hShift + 0.15) % 1, 0.7, 0.12 + bass * 0.05);

            col.setXYZ(bIdx, cBot.r * brightness, cBot.g * brightness, cBot.b * brightness);
            col.setXYZ(tIdx, cTop.r * brightness * 0.3, cTop.g * brightness * 0.3, cTop.b * brightness * 0.3);
        }

        pos.needsUpdate = true;
        col.needsUpdate = true;

        // Opacity pulse
        ribbon.material.opacity = 0.06 + (rIdx % 3) * 0.015 + bass * 0.06;
    });

    // Stars twinkle gently
    stars.material.opacity = 0.5 + Math.sin(t * 0.3) * 0.1 + smoothBass * 0.15;

    return { bg: new THREE.Color(0.006, 0.012, 0.03), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.2);
    ribbons.forEach(r => {
        r.material.opacity = (0.08 + (r.userData.layer % 3) * 0.02) + lf * 0.08;
    });
}

export function dispose(scene) {
    ribbons.forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
    if (stars) { scene.remove(stars); stars.geometry.dispose(); stars.material.dispose(); }
    // Remove mountains and ground
    scene.children.filter(c => c.isMesh && !ribbons.includes(c) && c !== stars).forEach(c => {
        scene.remove(c); c.geometry.dispose(); c.material.dispose();
    });
    ribbons = []; stars = mountains = null;
}
