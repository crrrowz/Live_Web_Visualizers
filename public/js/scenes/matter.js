// scenes/matter.js — Original Matter vs Antimatter scene
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from '../config.js';
import { pickRandom, vertexShader, fragmentShader } from '../shapes.js';

let matter, antimatter, particles;
let currentLevel = 1;

export function create(scene) {
    const shape1 = pickRandom();
    const shape2 = pickRandom();

    document.getElementById('shape-name').textContent = shape1.name + '  ×  ' + shape2.name;

    const matM = new THREE.ShaderMaterial({
        vertexShader, fragmentShader,
        uniforms: { uTime: { value: 0 }, uBass: { value: 0 }, uType: { value: 0.0 } }
    });
    matter = new THREE.Mesh(shape1.make(), matM);
    matter.position.x = -4;
    matter.scale.setScalar(CONFIG.objectBaseScale);
    scene.add(matter);

    const matA = new THREE.ShaderMaterial({
        vertexShader, fragmentShader,
        uniforms: { uTime: { value: 0 }, uBass: { value: 0 }, uType: { value: 1.0 } },
        wireframe: true
    });
    antimatter = new THREE.Mesh(shape2.make(), matA);
    antimatter.position.x = 4;
    antimatter.scale.setScalar(CONFIG.objectBaseScale);
    scene.add(antimatter);

    // Particles
    const pGeo = new THREE.BufferGeometry();
    const pCount = CONFIG.particleCount;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * CONFIG.particleSpread;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
        color: 0xffffff, size: CONFIG.particleBaseSize,
        transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending
    });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
}

export function update(time, bass, rawBass, smoothBass, camera) {
    // Attraction
    let targetDist = CONFIG.maxDistance * (1.0 - rawBass * CONFIG.attractionMultiplier);
    if (targetDist < 0) targetDist = 0;
    matter.position.x += (-targetDist / 2 - matter.position.x) * CONFIG.attractionSmoothing;
    antimatter.position.x = -matter.position.x;

    // Uniforms
    matter.material.uniforms.uTime.value = time;
    matter.material.uniforms.uBass.value = bass;
    antimatter.material.uniforms.uTime.value = time;
    antimatter.material.uniforms.uBass.value = bass;

    // Rotation
    const levelBoost = 1.0 + CONFIG.levelFactor(currentLevel, CONFIG.levelRotationMax);
    const rs = (CONFIG.baseRotationSpeed + bass * CONFIG.bassRotationBoost) * levelBoost;
    matter.rotation.y += rs * CONFIG.rotationMultiplierY;
    matter.rotation.z += rs * CONFIG.rotationMultiplierZ;
    antimatter.rotation.y -= rs * CONFIG.rotationMultiplierY;
    antimatter.rotation.z -= rs * CONFIG.rotationMultiplierZ;

    // Collision
    const dist = Math.abs(matter.position.x - antimatter.position.x);
    if (dist < CONFIG.collisionThreshold) {
        const glow = rawBass * 0.12;
        return { bg: new THREE.Color(glow * 0.3, glow * 0.1, glow * 0.5), collision: true };
    }
    particles.material.opacity *= 0.95;
    return { bg: new THREE.Color(CONFIG.bgColor[0], CONFIG.bgColor[1], CONFIG.bgColor[2]), collision: false };
}

export function onCollision(bass) {
    const pOpacity = Math.min(0.3 + CONFIG.levelFactor(currentLevel, 0.4), 0.7);
    particles.material.opacity = pOpacity;
    particles.scale.setScalar(1.0 + bass + CONFIG.levelFactor(currentLevel, 0.3));
    particles.rotation.y += 0.02;
}

export function updateLevel(level) {
    currentLevel = level;
    particles.material.size = CONFIG.particleBaseSize + CONFIG.levelFactor(level, CONFIG.levelParticleMax);
    const hue = (level * 30) % 360;
    const c = new THREE.Color();
    c.setHSL(hue / 360, 0.8, 0.55 + CONFIG.levelFactor(level, 0.2));
    particles.material.color = c;
    const scale = CONFIG.objectBaseScale + CONFIG.levelFactor(level, CONFIG.levelScaleMax);
    matter.scale.setScalar(scale);
    antimatter.scale.setScalar(scale);
}

export function dispose(scene) {
    if (matter) { scene.remove(matter); matter.geometry.dispose(); matter.material.dispose(); }
    if (antimatter) { scene.remove(antimatter); antimatter.geometry.dispose(); antimatter.material.dispose(); }
    if (particles) { scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); }
    matter = antimatter = particles = null;
}
