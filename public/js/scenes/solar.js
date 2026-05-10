// scenes/solar.js — Solar System scene with warp-speed star effect
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

// --- Planet data ---
const PLANET_DATA = [
    { name: 'Mercury', radius: 0.15, distance: 3.0,  speed: 1.8,  color: 0x8c7e6d },
    { name: 'Venus',   radius: 0.25, distance: 4.2,  speed: 1.3,  color: 0xe8c56d },
    { name: 'Earth',   radius: 0.28, distance: 5.5,  speed: 1.0,  color: 0x4a90d9 },
    { name: 'Mars',    radius: 0.2,  distance: 6.8,  speed: 0.8,  color: 0xc1440e },
    { name: 'Jupiter', radius: 0.65, distance: 9.0,  speed: 0.45, color: 0xc88b3a },
    { name: 'Saturn',  radius: 0.55, distance: 11.5, speed: 0.35, color: 0xd4a843 },
    { name: 'Uranus',  radius: 0.35, distance: 13.5, speed: 0.25, color: 0x5fc9c9 },
    { name: 'Neptune', radius: 0.33, distance: 15.5, speed: 0.18, color: 0x3b5dc9 },
];

let sun, planets = [], orbits = [], stars, starPositions;
let currentLevel = 1;
let warpFactor = 0;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Solar System';

    // --- Sun ---
    const sunGeo = new THREE.SphereGeometry(1.2, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 1.0,
    });
    sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    // Sun glow (larger transparent sphere)
    const glowGeo = new THREE.SphereGeometry(1.8, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
    });
    const sunGlow = new THREE.Mesh(glowGeo, glowMat);
    sun.add(sunGlow);

    // --- Planets ---
    PLANET_DATA.forEach((p) => {
        const geo = new THREE.SphereGeometry(p.radius, 32, 32);
        const mat = new THREE.MeshBasicMaterial({ color: p.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { ...p, angle: Math.random() * Math.PI * 2 };
        scene.add(mesh);
        planets.push(mesh);

        // Saturn ring
        if (p.name === 'Saturn') {
            const ringGeo = new THREE.RingGeometry(p.radius + 0.15, p.radius + 0.45, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xc8a85a,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2.5;
            mesh.add(ring);
        }

        // Orbit line
        const orbitGeo = new THREE.RingGeometry(p.distance - 0.02, p.distance + 0.02, 128);
        const orbitMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide
        });
        const orbit = new THREE.Mesh(orbitGeo, orbitMat);
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);
        orbits.push(orbit);
    });

    // --- Stars (warp field) ---
    const starCount = 4000;
    const sGeo = new THREE.BufferGeometry();
    starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPositions[i * 3]     = (Math.random() - 0.5) * 100;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    sGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const sMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.08,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });
    stars = new THREE.Points(sGeo, sMat);
    scene.add(stars);
}

export function update(time, bass, rawBass, smoothBass, camera) {
    // --- Sun pulse with bass ---
    const sunScale = 1.0 + bass * 0.3;
    sun.scale.setScalar(sunScale);
    sun.material.color.setHSL(0.08 + bass * 0.05, 1.0, 0.5 + bass * 0.2);

    // --- Planets orbit ---
    const orbitalBoost = 1.0 + bass * 2.0;
    planets.forEach((p) => {
        p.userData.angle += p.userData.speed * 0.003 * orbitalBoost;
        const a = p.userData.angle;
        const d = p.userData.distance;
        p.position.x = Math.cos(a) * d;
        p.position.z = Math.sin(a) * d;
        p.position.y = Math.sin(a * 0.5) * 0.3; // slight tilt
        p.rotation.y += 0.01;
    });

    // --- Star warp effect on voice ---
    warpFactor += (rawBass * 3.0 - warpFactor) * 0.1;
    const positions = stars.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += warpFactor * 0.5; // Move stars toward camera

        // Reset star if it passes camera
        if (positions[i + 2] > 50) {
            positions[i]     = (Math.random() - 0.5) * 100;
            positions[i + 1] = (Math.random() - 0.5) * 100;
            positions[i + 2] = -50;
        }
    }
    stars.geometry.attributes.position.needsUpdate = true;

    // Star size grows with warp
    stars.material.size = 0.08 + warpFactor * 0.15;
    stars.material.opacity = 0.5 + warpFactor * 0.2;

    const bg = CONFIG.bgColor;
    return { bg: new THREE.Color(bg[0], bg[1], bg[2]), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;

    // Sun grows logarithmically
    const sunBase = 1.0 + CONFIG.levelFactor(level, 0.5);
    sun.scale.setScalar(sunBase);

    // Planet colors shift and grow gently
    planets.forEach((p, i) => {
        const hueShift = (level * 15 + i * 40) % 360;
        p.material.color.setHSL(hueShift / 360, 0.7, 0.5 + CONFIG.levelFactor(level, 0.2));
        const sizeBoost = 1.0 + CONFIG.levelFactor(level, 0.3);
        p.scale.setScalar(sizeBoost);
    });

    // Orbit lines get slightly brighter
    orbits.forEach(o => {
        o.material.opacity = 0.06 + CONFIG.levelFactor(level, 0.15);
    });

    // Stars get slightly larger
    stars.material.size = 0.08 + CONFIG.levelFactor(level, 0.06);
}

export function dispose(scene) {
    if (sun) { scene.remove(sun); sun.geometry.dispose(); sun.material.dispose(); }
    planets.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
    orbits.forEach(o => { scene.remove(o); o.geometry.dispose(); o.material.dispose(); });
    if (stars) { scene.remove(stars); stars.geometry.dispose(); stars.material.dispose(); }
    sun = null; planets = []; orbits = []; stars = null;
}
