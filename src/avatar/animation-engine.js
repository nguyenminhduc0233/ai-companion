// ---------------------------------------------------------------------------
// Animation Engine — maps the assistant's state + mood to per-frame animation
// on the avatar rig. Works identically for the VRM rig and the procedural rig
// because both implement the same low-level interface:
//
//   setExpression(name, weight)   name ∈ happy|neutral|surprised|sad|relaxed|angry
//   setViseme(open01)             mouth open amount for talking
//   setBlink(v01)                 0 = eyes open, 1 = closed
//   setHead({pitch,yaw,roll})     radians
//   setArms({raise01, chin01, cheer01})
//   setBody({breathe, sway})
//   burst()                       particle burst (celebrate)
//   update(dt)
//
// Activities: idle | listening | thinking | talking   (TÀI LIỆU 2 + 3)
// ---------------------------------------------------------------------------

const MOOD_TO_EXPR = {
  happy: 'happy',
  normal: 'neutral',
  thinking: 'neutral',
  surprise: 'surprised',
  sympathy: 'sad',
  celebrate: 'happy',
  idle: 'relaxed'
};

const EXPRESSIONS = ['happy', 'neutral', 'surprised', 'sad', 'relaxed', 'angry'];

function lerp(a, b, t) { return a + (b - a) * t; }

// Idle micro-actions so the character is never perfectly still
// ("không đứng yên": đọc sách, uống trà, viết ghi chú, nhìn cửa sổ, vuốt tóc).
const IDLE_ACTIONS = ['lookWindow', 'strokeHair', 'read', 'sip', 'note', 'rest'];

export class AnimationEngine {
  constructor(rig) {
    this.rig = rig;
    this.t = 0;
    this.activity = 'idle';
    this.mood = 'normal';

    this.exprWeights = Object.fromEntries(EXPRESSIONS.map((e) => [e, 0]));
    this.exprTarget = { ...this.exprWeights, relaxed: 0.6 };

    this.blink = 0;
    this.nextBlink = 1.5;

    this.viseme = 0;
    this.headTarget = { pitch: 0, yaw: 0, roll: 0 };
    this.head = { pitch: 0, yaw: 0, roll: 0 };
    this.arms = { raise: 0, chin: 0, cheer: 0 };
    this.armsTarget = { raise: 0, chin: 0, cheer: 0 };

    this.idleAction = 'rest';
    this.idleTimer = 0;
    this.idleDuration = 4;
    this._cheerBurstDone = false;
  }

  setMood(mood) {
    this.mood = mood || 'normal';
    const expr = MOOD_TO_EXPR[this.mood] || 'neutral';
    for (const e of EXPRESSIONS) this.exprTarget[e] = 0;
    this.exprTarget[expr] = this.mood === 'celebrate' ? 1 : 0.85;
    if (this.mood === 'celebrate') { this._cheerBurstDone = false; }
  }

  setActivity(activity) {
    this.activity = activity || 'idle';
    // Reset gesture targets; per-frame logic sets them.
    this.armsTarget = { raise: 0, chin: 0, cheer: 0 };
  }

  _pickIdleAction() {
    this.idleAction = IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];
    this.idleDuration = 3 + Math.random() * 4;
    this.idleTimer = 0;
  }

  update(dt) {
    this.t += dt;

    // --- Blink scheduling ---
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blink === 0) {
      this.blink = 0.0001;
    }
    if (this.blink > 0) {
      // quick close then open (~0.16s)
      this.blink += dt / 0.08;
      if (this.blink >= 2) { this.blink = 0; this.nextBlink = 1.5 + Math.random() * 3.5; }
    }
    const blinkVal = this.blink === 0 ? 0 : (this.blink <= 1 ? this.blink : 2 - this.blink);

    // --- Breathing + sway ---
    const breathe = Math.sin(this.t * 1.6) * 0.5 + 0.5; // 0..1
    const sway = Math.sin(this.t * 0.6) * 1;

    // --- Activity-driven head / arms / viseme ---
    let visemeTarget = 0;
    if (this.activity === 'talking') {
      // Lip flap: layered sines + a little randomness.
      visemeTarget = Math.max(0, Math.sin(this.t * 11) * 0.5 + Math.sin(this.t * 6.3) * 0.3 + 0.2);
      this.headTarget = { pitch: Math.sin(this.t * 2) * 0.04, yaw: Math.sin(this.t * 1.3) * 0.06, roll: Math.sin(this.t * 0.9) * 0.02 };
    } else if (this.activity === 'listening') {
      // Look toward the user and nod gently.
      this.headTarget = { pitch: -0.06 + Math.sin(this.t * 2.2) * 0.05, yaw: 0, roll: Math.sin(this.t * 0.8) * 0.03 };
    } else if (this.activity === 'thinking') {
      // Look up + hand to chin.
      this.headTarget = { pitch: -0.16, yaw: 0.12, roll: 0.03 };
      this.armsTarget.chin = 1;
    } else {
      // Idle: cycle small actions.
      this.idleTimer += dt;
      if (this.idleTimer >= this.idleDuration) this._pickIdleAction();
      switch (this.idleAction) {
        case 'lookWindow': this.headTarget = { pitch: -0.04, yaw: 0.28, roll: 0.02 }; break;
        case 'strokeHair': this.headTarget = { pitch: 0.03, yaw: -0.12, roll: -0.05 }; this.armsTarget.raise = 0.35; break;
        case 'read': this.headTarget = { pitch: 0.16, yaw: -0.05, roll: 0 }; this.armsTarget.raise = 0.25; break;
        case 'sip': this.headTarget = { pitch: 0.05, yaw: 0.05, roll: 0 }; this.armsTarget.chin = 0.5; break;
        case 'note': this.headTarget = { pitch: 0.2, yaw: 0.02, roll: 0 }; this.armsTarget.raise = 0.2; break;
        default: this.headTarget = { pitch: Math.sin(this.t * 0.5) * 0.03, yaw: Math.sin(this.t * 0.4) * 0.05, roll: 0 };
      }
    }

    if (this.mood === 'celebrate') {
      this.armsTarget.cheer = 1;
      this.headTarget = { pitch: -0.1, yaw: 0, roll: Math.sin(this.t * 6) * 0.05 };
      if (!this._cheerBurstDone && this.rig.burst) { this.rig.burst(); this._cheerBurstDone = true; }
    }

    // --- Smooth toward targets ---
    const k = Math.min(1, dt * 6);
    this.viseme = lerp(this.viseme, visemeTarget, Math.min(1, dt * 18));
    this.head.pitch = lerp(this.head.pitch, this.headTarget.pitch, k);
    this.head.yaw = lerp(this.head.yaw, this.headTarget.yaw, k);
    this.head.roll = lerp(this.head.roll, this.headTarget.roll, k);
    this.arms.raise = lerp(this.arms.raise, this.armsTarget.raise, k);
    this.arms.chin = lerp(this.arms.chin, this.armsTarget.chin, k);
    this.arms.cheer = lerp(this.arms.cheer, this.armsTarget.cheer, Math.min(1, dt * 8));
    for (const e of EXPRESSIONS) this.exprWeights[e] = lerp(this.exprWeights[e], this.exprTarget[e], k);

    // --- Apply to rig ---
    for (const e of EXPRESSIONS) this.rig.setExpression(e, this.exprWeights[e]);
    this.rig.setBlink(blinkVal);
    this.rig.setViseme(this.viseme);
    this.rig.setHead(this.head);
    this.rig.setArms(this.arms);
    this.rig.setBody({ breathe, sway });
    if (this.rig.update) this.rig.update(dt);
  }
}
