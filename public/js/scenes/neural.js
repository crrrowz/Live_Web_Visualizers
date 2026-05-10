// scenes/neural.js — Enhanced Neural Network with pulse propagation
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';

let neurons = [], synapses = [], pulseParticles;
let neuronGroup;
let currentLevel = 1;

const NEURON_COUNT = 50;
const MAX_CONNECTIONS = 3;

export function create(scene) {
    document.getElementById('shape-name').textContent = 'Neural Network';
    neuronGroup = new THREE.Group();
    scene.add(neuronGroup);

    // Create neurons in layered clusters
    const layers = [
        { count: 8,  x: -6, spread: 4 },
        { count: 12, x: -2, spread: 5 },
        { count: 14, x: 2,  spread: 5.5 },
        { count: 10, x: 5,  spread: 4.5 },
        { count: 6,  x: 8,  spread: 3 },
    ];

    const nGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const outerGeo = new THREE.SphereGeometry(0.18, 8, 8);

    layers.forEach(layer => {
        for (let i = 0; i < layer.count; i++) {
            const hue = 0.5 + Math.random() * 0.2;
            // Neuron body
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 0.9, 0.5),
                transparent: true, opacity: 0.8
            });
            const neuron = new THREE.Mesh(nGeo, mat);
            neuron.position.set(
                layer.x + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * layer.spread,
                (Math.random() - 0.5) * 4
            );

            // Glow halo
            const glowMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 1.0, 0.4),
                transparent: true, opacity: 0.0,
                blending: THREE.AdditiveBlending
            });
            const glow = new THREE.Mesh(outerGeo, glowMat);
            neuron.add(glow);

            neuron.userData = {
                baseScale: 0.7 + Math.random() * 0.6,
                hue,
                firePhase: Math.random() * Math.PI * 2,
                layer: layers.indexOf(layer)
            };
            neuronGroup.add(neuron);
            neurons.push(neuron);
        }
    });

    // Connect neurons to nearest neighbors
    neurons.forEach((n, i) => {
        const distances = neurons
            .map((other, j) => ({ idx: j, dist: n.position.distanceTo(other.position) }))
            .filter(d => d.idx !== i && d.dist < 6)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_CONNECTIONS);

        distances.forEach(d => {
            const other = neurons[d.idx];
            const geo = new THREE.BufferGeometry().setFromPoints([n.position, other.position]);
            const mat = new THREE.LineBasicMaterial({
                color: 0x2266cc, transparent: true, opacity: 0.04,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geo, mat);
            line.userData = {
                from: n, to: other,
                pulsePhase: Math.random() * Math.PI * 2,
                dist: d.dist
            };
            neuronGroup.add(line);
            synapses.push(line);
        });
    });

    // Pulse particles along synapses
    const ppCount = 300;
    const ppGeo = new THREE.BufferGeometry();
    const ppPos = new Float32Array(ppCount * 3);
    ppGeo.setAttribute('position', new THREE.BufferAttribute(ppPos, 3));
    pulseParticles = new THREE.Points(ppGeo, new THREE.PointsMaterial({
        color: 0x66ddff, size: 0.06, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending
    }));
    scene.add(pulseParticles);
}

export function update(time, bass, rawBass, smoothBass) {
    const t = time * 3;

    // Neurons fire
    neurons.forEach((n, i) => {
        const fireStrength = Math.sin(t + n.userData.firePhase) * 0.5 + 0.5;
        const isFiring = fireStrength > 0.7 && bass > 0.1;

        const scale = n.userData.baseScale * (1.0 + (isFiring ? bass * 0.4 : bass * 0.1));
        n.scale.setScalar(scale);
        n.material.opacity = 0.5 + (isFiring ? 0.5 : bass * 0.2);

        // Glow halo
        const glow = n.children[0];
        if (glow) {
            glow.material.opacity = isFiring ? bass * 0.2 : 0.0;
            glow.scale.setScalar(1.0 + (isFiring ? bass * 0.6 : 0));
        }
    });

    // Synapses carry signals
    synapses.forEach(s => {
        const fromFire = Math.sin(t + s.userData.from.userData.firePhase) * 0.5 + 0.5;
        const signal = fromFire > 0.7 ? bass * 0.5 : 0;
        s.material.opacity = 0.02 + signal * 0.3;
        const hue = 0.55 + signal * 0.15;
        s.material.color.setHSL(hue, 0.9, 0.4 + signal * 0.3);
    });

    // Pulse particles travel along random synapses
    if (bass > 0.15) {
        const ppPos = pulseParticles.geometry.attributes.position.array;
        for (let i = 0; i < ppPos.length / 3; i++) {
            const synapse = synapses[i % synapses.length];
            const progress = (Math.sin(t * 2 + i * 0.3) * 0.5 + 0.5);
            const from = synapse.userData.from.position;
            const to = synapse.userData.to.position;
            ppPos[i * 3]     = from.x + (to.x - from.x) * progress;
            ppPos[i * 3 + 1] = from.y + (to.y - from.y) * progress;
            ppPos[i * 3 + 2] = from.z + (to.z - from.z) * progress;
        }
        pulseParticles.geometry.attributes.position.needsUpdate = true;
        pulseParticles.material.opacity = bass * 0.5;
    } else {
        pulseParticles.material.opacity *= 0.9;
    }

    // Gentle rotation
    neuronGroup.rotation.y += 0.001 + bass * 0.002;

    return { bg: new THREE.Color(0.01, 0.008, 0.025), collision: false };
}

export function onCollision() {}

export function updateLevel(level) {
    currentLevel = level;
    const lf = CONFIG.levelFactor(level, 0.3);
    neurons.forEach(n => {
        const h = (n.userData.hue + lf * 0.3) % 1;
        n.material.color.setHSL(h, 0.9, 0.5 + lf * 0.2);
        n.userData.baseScale = (0.7 + Math.random() * 0.6) * (1.0 + CONFIG.levelFactor(level, 0.2));
    });
    pulseParticles.material.size = 0.06 + CONFIG.levelFactor(level, 0.04);
}

export function dispose(scene) {
    if (neuronGroup) scene.remove(neuronGroup);
    if (pulseParticles) { scene.remove(pulseParticles); pulseParticles.geometry.dispose(); }
    neurons = []; synapses = []; neuronGroup = null; pulseParticles = null;
}
