// scenes/ocean.js — Enhanced Deep Ocean with bioluminescence
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let jellyfish = [], bioParticles, bubbles, causticPlane, lightRays;
let currentLevel = 1;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Deep Ocean';

    // --- Jellyfish with better anatomy ---
    for (let i = 0; i < 10; i++) {
        const group = new THREE.Group();
        const size = 0.3 + Math.random() * 0.4;
        const hue = 0.45 + Math.random() * 0.35;

        // Bell (dome)
        const bellGeo = new THREE.SphereGeometry(size, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
        const bellMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.85, 0.5),
            transparent: true, opacity: 0.35,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending
        });
        group.add(new THREE.Mesh(bellGeo, bellMat));

        // Inner glow
        const innerGeo = new THREE.SphereGeometry(size * 0.6, 16, 16);
        const innerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 1.0, 0.7),
            transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending
        });
        group.add(new THREE.Mesh(innerGeo, innerMat));

        // Tentacles (multiple thin cylinders)
        const tentCount = 6 + Math.floor(Math.random() * 4);
        for (let t = 0; t < tentCount; t++) {
            const angle = (t / tentCount) * Math.PI * 2;
            const tentLen = 1.0 + Math.random() * 1.5;
            const tGeo = new THREE.CylinderGeometry(0.008, 0.003, tentLen, 4);
            const tMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 0.7, 0.55),
                transparent: true, opacity: 0.25
            });
            const tent = new THREE.Mesh(tGeo, tMat);
            tent.position.set(Math.cos(angle) * size * 0.5, -size * 0.3 - tentLen * 0.4, Math.sin(angle) * size * 0.5);
            tent.userData = { angle, tentLen, phase: Math.random() * Math.PI * 2 };
            group.add(tent);
        }

        group.position.set(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 10
        );
        group.userData = { speed: 0.001 + Math.random() * 0.003, phase: Math.random() * Math.PI * 2, hue, size };
        scene.add(group);
        jellyfish.push(group);
    }

    // --- Bioluminescent plankton ---
    const bCount = 4000;
    const bGeo = new THREE.BufferGeometry();
    const bPos = new Float32Array(bCount * 3);
    const bCol = new Float32Array(bCount * 3);
    for (let i = 0; i < bCount; i++) {
        bPos[i * 3] = (Math.random() - 0.5) * 30;
        bPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
        bPos[i * 3 + 2] = (Math.random() - 0.5) * 15;
        const c = new THREE.Color().setHSL(0.45 + Math.random() * 0.3, 0.9, 0.5 + Math.random() * 0.3);
        bCol[i * 3] = c.r; bCol[i * 3 + 1] = c.g; bCol[i * 3 + 2] = c.b;
    }
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    bioParticles = new THREE.Points(bGeo, new THREE.PointsMaterial({
        size: 0.035, vertexColors: true, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(bioParticles);

    // --- Rising bubbles ---
    const buCount = 400;
    const buGeo = new THREE.BufferGeometry();
    const buPos = new Float32Array(buCount * 3);
    for (let i = 0; i < buCount; i++) {
        buPos[i * 3] = (Math.random() - 0.5) * 24;
        buPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
        buPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    buGeo.setAttribute('position', new THREE.BufferAttribute(buPos, 3));
    bubbles = new THREE.Points(buGeo, new THREE.PointsMaterial({
        color: 0x88ddff, size: 0.05, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending
    }));
    scene.add(bubbles);

    // --- Light rays from above ---
    for (let i = 0; i < 4; i++) {
        const rGeo = new THREE.PlaneGeometry(1.5, 25);
        const rMat = new THREE.MeshBasicMaterial({
            color: 0x2288aa, transparent: true, opacity: 0.03,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const ray = new THREE.Mesh(rGeo, rMat);
        ray.position.set((i - 1.5) * 5, 3, -5);
        ray.rotation.z = (Math.random() - 0.5) * 0.3;
        scene.add(ray);
    }
}

export function update(time, bass, rawBass, smoothBass) {
    const t = time * 2;

    // --- Jellyfish movement ---
    jellyfish.forEach(j => {
        const ph = j.userData.phase;
        // Gentle floating
        j.position.y += Math.sin(t + ph) * 0.004;
        j.position.x += Math.cos(t * 0.5 + ph) * 0.002;
        j.rotation.x = Math.sin(t * 0.8 + ph) * 0.08;
        j.rotation.z = Math.cos(t * 0.6 + ph) * 0.05;

        // Bell pulses (swimming motion)
        const bell = j.children[0];
        const swimPulse = Math.sin(t * 2 + ph) * 0.1;
        bell.scale.set(1.0 + swimPulse, 1.0 - swimPulse * 0.5, 1.0 + swimPulse);

        // Voice makes them glow
        bell.material.opacity = 0.25 + bass * 0.45;
        const inner = j.children[1];
        inner.material.opacity = 0.08 + bass * 0.3;

        // Tentacles sway
        for (let k = 2; k < j.children.length; k++) {
            const tent = j.children[k];
            const tp = tent.userData.phase;
            tent.rotation.x = Math.sin(t + tp) * 0.15 + bass * 0.1;
            tent.rotation.z = Math.cos(t * 0.7 + tp) * 0.1;
        }

        const hue = j.userData.hue + bass * 0.1;
        bell.material.color.setHSL(hue, 0.85, 0.45 + bass * 0.25);
    });

    // Bio particles drift and sparkle
    bioParticles.rotation.y += 0.0002;
    bioParticles.rotation.x += 0.0001;
    bioParticles.material.opacity = 0.1 + smoothBass * 0.35;
    bioParticles.material.size = 0.03 + bass * 0.03;

    // Bubbles rise faster with voice
    const buPos = bubbles.geometry.attributes.position.array;
    for (let i = 1; i < buPos.length; i += 3) {
        buPos[i] += 0.008 + bass * 0.04;
        if (buPos[i] > 10) buPos[i] = -10;
    }
    bubbles.geometry.attributes.position.needsUpdate = true;
    bubbles.material.opacity = 0.1 + bass * 0.15;

    return { bg: new THREE.Color(0.0, 0.015, 0.05), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.25);
    jellyfish.forEach(j => {
        const hue = (j.userData.hue + lf * 0.2) % 1;
        j.children[0].material.color.setHSL(hue, 0.9, 0.5 + lf * 0.15);
        j.scale.setScalar(1.0 + CONFIG.levelFactor(level, 0.25));
    });
    bioParticles.material.size = 0.035 + CONFIG.levelFactor(level, 0.03);
}

export function dispose(scene) {
    jellyfish.forEach(j => scene.remove(j));
    if (bioParticles) { scene.remove(bioParticles); bioParticles.geometry.dispose(); }
    if (bubbles) { scene.remove(bubbles); bubbles.geometry.dispose(); }
    jellyfish = []; bioParticles = bubbles = null;
}
