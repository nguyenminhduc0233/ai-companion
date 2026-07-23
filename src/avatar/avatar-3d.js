// ---------------------------------------------------------------------------
// 3D Avatar (Three.js). Two interchangeable rigs implement the same interface
// consumed by the AnimationEngine:
//   - VrmRig: loads a .vrm (three-vrm) for maximum fidelity (Settings → VRM URL)
//   - ProceduralRig: a stylized 3D character built in code, matching the manhua
//     reference (long black hair, silver ornament, flowing white dress, violet
//     aura). This is the reliable default and needs no external asset.
// Both are true real-time 3D (WebGL) and run identically in the APK and EXE.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationEngine } from './animation-engine.js';

const SKIN = 0xffe0d0;
const HAIR = 0x1b1726;
const DRESS = 0xf4f1ff;
const SILVER = 0xd8e6ff;
const VIOLET = 0x9a86ff;

// =====================================================================
// Procedural stylized rig
// =====================================================================
class ProceduralRig {
  constructor() {
    this.root = new THREE.Group();
    this._expr = {};
    this._blink = 0;
    this._viseme = 0;
    this._head = { pitch: 0, yaw: 0, roll: 0 };
    this._arms = { raise: 0, chin: 0, cheer: 0 };
    this._body = { breathe: 0.5, sway: 0 };
    this._t = 0;
    this._build();
  }

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0.05, ...opts });
  }

  _build() {
    // Body group (torso + arms + skirt), pivots for breathing/sway.
    this.body = new THREE.Group();
    this.body.position.y = 0.9;
    this.root.add(this.body);

    // Torso / dress bodice
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.3, 0.72, 24),
      this._mat(DRESS, { emissive: VIOLET, emissiveIntensity: 0.06, rough: 0.5 })
    );
    torso.position.y = 0.0;
    this.body.add(torso);

    // Skirt (flowing)
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 0.95, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: DRESS, emissive: VIOLET, emissiveIntensity: 0.08, roughness: 0.5, transparent: true, opacity: 0.96, side: THREE.DoubleSide })
    );
    skirt.position.y = -0.75;
    this.body.add(skirt);

    // Shoulders base
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), this._mat(DRESS, { emissive: VIOLET, emissiveIntensity: 0.05 }));
    shoulders.scale.set(1, 0.42, 0.8);
    shoulders.position.y = 0.34;
    this.body.add(shoulders);

    // Arms (pivot at shoulder)
    this.armL = this._makeArm(-1);
    this.armR = this._makeArm(1);
    this.armL.position.set(-0.28, 0.32, 0);
    this.armR.position.set(0.28, 0.32, 0);
    this.body.add(this.armL, this.armR);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 16), this._mat(SKIN));
    neck.position.y = 0.46;
    this.body.add(neck);

    // Head group
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    this.body.add(this.head);
    this._buildHead();
    this._buildHair();
    this._buildAura();
  }

  _makeArm(side) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.34, 14), this._mat(DRESS, { emissive: VIOLET, emissiveIntensity: 0.05 }));
    upper.position.y = -0.17;
    const fore = new THREE.Group();
    fore.position.y = -0.34;
    const foreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.32, 14), this._mat(SKIN));
    foreMesh.position.y = -0.16;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), this._mat(SKIN));
    hand.position.y = -0.34;
    fore.add(foreMesh, hand);
    g.add(upper, fore);
    g.userData.fore = fore;
    // rest slightly outward
    g.rotation.z = side * 0.12;
    return g;
  }

  _buildHead() {
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 28), this._mat(SKIN, { rough: 0.55 }));
    skull.scale.set(1, 1.06, 0.98);
    this.head.add(skull);

    const faceZ = 0.36;
    // Eyes (big anime style): white base + violet iris + highlight
    this.eyeL = this._makeEye();
    this.eyeR = this._makeEye();
    this.eyeL.position.set(-0.15, 0.02, faceZ);
    this.eyeR.position.set(0.15, 0.02, faceZ);
    this.head.add(this.eyeL, this.eyeR);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.13, 0.018, 0.02);
    const browMat = this._mat(HAIR, { rough: 0.7 });
    this.browL = new THREE.Mesh(browGeo, browMat);
    this.browR = new THREE.Mesh(browGeo, browMat);
    this.browL.position.set(-0.15, 0.16, faceZ + 0.02);
    this.browR.position.set(0.15, 0.16, faceZ + 0.02);
    this.head.add(this.browL, this.browR);

    // Mouth: lips (neutral) + inner (open) + smile arc (happy)
    this.mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: 0x5a2233, roughness: 0.6 }));
    this.mouthInner.scale.set(1.1, 0.2, 0.5);
    this.mouthInner.position.set(0, -0.16, faceZ);
    this.head.add(this.mouthInner);

    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0546a, roughness: 0.6 }));
    this.smile.rotation.z = Math.PI; // open side up → smile
    this.smile.position.set(0, -0.14, faceZ + 0.01);
    this.smile.scale.setScalar(0.9);
    this.head.add(this.smile);

    // Blush
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff9bb0, transparent: true, opacity: 0 });
    this.blushL = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), blushMat.clone());
    this.blushR = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), blushMat.clone());
    this.blushL.position.set(-0.22, -0.05, faceZ - 0.02);
    this.blushR.position.set(0.22, -0.05, faceZ - 0.02);
    this.head.add(this.blushL, this.blushR);
  }

  _makeEye() {
    const g = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    white.scale.set(1.1, 1.5, 0.4);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: VIOLET, emissive: VIOLET, emissiveIntensity: 0.35, roughness: 0.3 }));
    iris.scale.set(1, 1.35, 0.4); iris.position.z = 0.02;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), new THREE.MeshBasicMaterial({ color: 0x140f22 }));
    pupil.scale.set(1, 1.3, 0.4); pupil.position.z = 0.035;
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hi.position.set(0.02, 0.03, 0.05);
    g.add(white, iris, pupil, hi);
    return g;
  }

  _buildHair() {
    const hairMat = this._mat(HAIR, { rough: 0.4, metal: 0.15 });
    // Back mass (long)
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 20), hairMat);
    back.scale.set(1.02, 1.15, 0.9); back.position.set(0, 0.03, -0.06);
    this.head.add(back);
    const backLong = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 1.1, 20), hairMat);
    backLong.position.set(0, -0.62, -0.16);
    this.body.add(backLong); // drapes over the body
    // Bangs
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    bangs.scale.set(1.03, 1, 1.02); bangs.position.set(0, 0.12, 0.02);
    this.head.add(bangs);
    // Side locks
    const lockGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.8, 12);
    const lockL = new THREE.Mesh(lockGeo, hairMat); lockL.position.set(-0.34, -0.2, 0.16);
    const lockR = new THREE.Mesh(lockGeo, hairMat); lockR.position.set(0.34, -0.2, 0.16);
    this.head.add(lockL, lockR);
    // Silver ornament (hairpiece + stars)
    const orn = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), new THREE.MeshStandardMaterial({ color: SILVER, emissive: SILVER, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.2 }));
    ring.position.set(0.24, 0.3, 0.14); ring.rotation.set(0.5, 0.3, 0);
    orn.add(ring);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), new THREE.MeshStandardMaterial({ color: SILVER, emissive: SILVER, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.15 }));
      star.position.set(0.1 + Math.random() * 0.28, 0.18 + Math.random() * 0.28, 0.1 + Math.random() * 0.1);
      orn.add(star);
    }
    this.head.add(orn);
  }

  _buildAura() {
    const N = 140;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this._auraVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.8;
      pos[i * 3 + 1] = Math.random() * 2.2 - 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      this._auraVel[i] = 0.08 + Math.random() * 0.14;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: VIOLET, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    this.aura = new THREE.Points(geo, mat);
    this.root.add(this.aura);
    this._auraBurst = 0;
  }

  // --- interface ---
  setExpression(name, w) { this._expr[name] = w; }
  setBlink(v) { this._blink = v; }
  setViseme(v) { this._viseme = v; }
  setHead(o) { this._head = o; }
  setArms(o) { this._arms = o; }
  setBody(o) { this._body = o; }
  burst() { this._auraBurst = 1; }

  update(dt) {
    this._t += dt;
    const e = this._expr;
    const happy = e.happy || 0, surprised = e.surprised || 0, sad = e.sad || 0, angry = e.angry || 0;

    // Head transform
    this.head.rotation.set(this._head.pitch, this._head.yaw, this._head.roll);
    // Body breathe + sway
    const br = (this._body.breathe - 0.5) * 0.03;
    this.body.scale.y = 1 + br;
    this.body.rotation.z = (this._body.sway || 0) * 0.01;
    this.body.position.x = (this._body.sway || 0) * 0.01;

    // Eyes: blink + surprise widen
    const openY = (1 - this._blink) * (1 + surprised * 0.35);
    this.eyeL.scale.y = Math.max(0.04, openY);
    this.eyeR.scale.y = Math.max(0.04, openY);

    // Eyebrows: surprise up, sad inner-up, angry inner-down
    const browBase = 0.16;
    this.browL.position.y = browBase + surprised * 0.05 + sad * 0.03;
    this.browR.position.y = browBase + surprised * 0.05 + sad * 0.03;
    this.browL.rotation.z = -angry * 0.4 + sad * 0.3 + happy * 0.1;
    this.browR.rotation.z = angry * 0.4 - sad * 0.3 - happy * 0.1;

    // Mouth: viseme open + smile for happy
    const open = Math.min(1, this._viseme + surprised * 0.4);
    this.mouthInner.scale.set(1.1 + happy * 0.3, 0.14 + open * 0.9, 0.5);
    this.smile.scale.setScalar(0.6 + happy * 0.8);
    this.smile.material.opacity = 1;
    this.smile.visible = happy > 0.1 && open < 0.4;
    this.mouthInner.visible = !(happy > 0.4 && open < 0.2);

    // Blush
    const blush = Math.min(1, happy * 0.7 + sad * 0.15);
    this.blushL.material.opacity = blush * 0.7;
    this.blushR.material.opacity = blush * 0.7;

    // Arms: raise / chin / cheer
    const raise = this._arms.raise, chin = this._arms.chin, cheer = this._arms.cheer;
    // base rest
    this.armL.rotation.z = 0.12 + raise * 0.5 + cheer * 2.2;
    this.armR.rotation.z = -0.12 - raise * 0.5 - cheer * 2.2 - chin * 0.6;
    this.armR.rotation.x = -chin * 1.1;
    this.armR.userData.fore.rotation.x = -chin * 1.4;
    this.armL.rotation.x = -cheer * 0.3;
    this.armR.rotation.x += -cheer * 0.3;

    // Aura drift
    const p = this.aura.geometry.attributes.position;
    const arr = p.array;
    const boost = 1 + this._auraBurst * 6;
    for (let i = 0; i < this._auraVel.length; i++) {
      arr[i * 3 + 1] += this._auraVel[i] * dt * boost;
      arr[i * 3] += Math.sin(this._t * 0.8 + i) * dt * 0.05;
      if (arr[i * 3 + 1] > 2.2) { arr[i * 3 + 1] = -0.3; }
    }
    p.needsUpdate = true;
    this.aura.rotation.y += dt * 0.05;
    if (this._auraBurst > 0) this._auraBurst = Math.max(0, this._auraBurst - dt * 1.5);
  }
}

// =====================================================================
// VRM rig (optional, higher fidelity)
// =====================================================================
class VrmRig {
  constructor(vrm) {
    this.vrm = vrm;
    this.root = vrm.scene;
    this._expr = {}; this._blink = 0; this._viseme = 0;
    this._head = { pitch: 0, yaw: 0, roll: 0 };
    this._arms = { raise: 0, chin: 0, cheer: 0 };
    this._body = { breathe: 0.5, sway: 0 };
    this.h = vrm.humanoid;
  }
  _bone(name) { return this.h && this.h.getNormalizedBoneNode ? this.h.getNormalizedBoneNode(name) : null; }
  setExpression(name, w) { this._expr[name] = w; }
  setBlink(v) { this._blink = v; }
  setViseme(v) { this._viseme = v; }
  setHead(o) { this._head = o; }
  setArms(o) { this._arms = o; }
  setBody(o) { this._body = o; }
  burst() {}
  update(dt) {
    const em = this.vrm.expressionManager;
    if (em) {
      for (const [k, v] of Object.entries(this._expr)) { try { em.setValue(k, v); } catch (_) {} }
      try { em.setValue('blink', this._blink); } catch (_) {}
      try { em.setValue('aa', this._viseme); } catch (_) {}
    }
    const head = this._bone('head');
    if (head) head.rotation.set(this._head.pitch, this._head.yaw, this._head.roll);
    const chest = this._bone('chest') || this._bone('spine');
    if (chest) chest.rotation.z = (this._body.sway || 0) * 0.01;
    const ua = this._bone('rightUpperArm');
    const ul = this._bone('leftUpperArm');
    if (ua) ua.rotation.z = -1.2 + this._arms.cheer * 1.0 + this._arms.chin * 0.3;
    if (ul) ul.rotation.z = 1.2 - this._arms.cheer * 1.0;
    this.vrm.update(dt);
  }
}

// =====================================================================
// Static glTF/GLB rig — for non-VRM models (no expression/humanoid data).
// Auto-centers + scales the model and applies gentle idle motion.
// =====================================================================
class StaticGlbRig {
  constructor(scene) {
    this.root = new THREE.Group();
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const h = size.y || 1;
    const s = 1.5 / h;
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -center.y * s + 1.0, -center.z * s);
    this.model = scene;
    this.root.add(scene);
    this._t = 0;
    this._head = { pitch: 0, yaw: 0, roll: 0 };
    this._body = { breathe: 0.5, sway: 0 };
  }
  setExpression() {}
  setBlink() {}
  setViseme() {}
  setArms() {}
  setHead(o) { this._head = o; }
  setBody(o) { this._body = o; }
  burst() {}
  update(dt) {
    this._t += dt;
    this.model.rotation.y = (this._head.yaw || 0) * 0.5 + Math.sin(this._t * 0.3) * 0.05;
    this.model.position.y = 1.0 + (this._body.breathe - 0.5) * 0.02;
  }
}

// =====================================================================
// Controller
// =====================================================================
export class Avatar3D {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this._raf = null;
  }

  async init({ vrmUrl = '', mode = 'auto' } = {}) {
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    this.camera.position.set(0, 1.45, 2.4);
    this.camera.lookAt(0, 1.25, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    // Lights — soft key + violet rim for the ethereal look.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 4, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(VIOLET, 0.9); rim.position.set(-3, 2, -2); this.scene.add(rim);
    const fill = new THREE.PointLight(0x88bbff, 0.5, 12); fill.position.set(0, 1, 3); this.scene.add(fill);

    // Choose rig.
    this.rig = null;
    const url = vrmUrl || '';
    if (mode !== 'procedural' && url) {
      try {
        const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync(url);
        const vrm = gltf.userData.vrm;
        if (vrm) {
          try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (_) {}
          if (vrm.meta && (vrm.meta.metaVersion === '0' || vrm.meta.metaVersion === 0)) VRMUtils.rotateVRM0(vrm);
          this.rig = new VrmRig(vrm);
          this.kind = 'vrm';
        } else {
          // A plain glTF/GLB (no VRM humanoid): show it statically with idle motion.
          this.rig = new StaticGlbRig(gltf.scene);
          this.kind = 'glb';
        }
      } catch (err) {
        console.warn('3D model load failed, using procedural avatar:', err);
      }
    }
    if (!this.rig) {
      this.rig = new ProceduralRig();
      this.kind = 'procedural';
    }
    this.scene.add(this.rig.root);

    this.engine = new AnimationEngine(this.rig);
    this.engine.setMood('normal');
    this.engine.setActivity('idle');

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.container);

    this._loop();
    return this.kind;
  }

  setMood(mood) { this.engine && this.engine.setMood(mood); }
  setActivity(state) { this.engine && this.engine.setActivity(state); }

  resize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _loop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (this.engine) this.engine.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); }
  }
}
