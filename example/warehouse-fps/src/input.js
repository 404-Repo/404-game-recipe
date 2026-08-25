/**
 * Input: keyboard + mouse with pointer lock, and touch.
 *
 * Two things here are deliberate and load-bearing.
 *
 * 1. ARROW KEYS. `harness/playtest.mjs` drives with ArrowUp / ArrowLeft /
 *    ArrowRight and steers by `__GAME__.pos`. Binding them to walk-forward and
 *    yaw is what lets the repo's own harness drive this game at all. It is NOT
 *    a test of the game: the harness has no mouse, so it never aims and never
 *    fires. See tools/motiontest.mjs for the gate that does.
 *
 * 2. TOUCH IS REAL INPUT, NOT A DEBUG HOOK. Everything below is driven from
 *    touchstart/touchmove/touchend on actual DOM elements, exactly as a finger
 *    would. A build here shipped unstartable on every phone for weeks because
 *    every check drove it through the game's own debug entry points.
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };       // -1..1, y forward
    this.look = { x: 0, y: 0 };       // consumed per frame (radians)
    this.turn = 0;                    // arrow-key yaw rate, rad/s
    this.fire = false; this.ads = false; this.reload = false;
    this.jump = false; this.crouch = false; this.sprint = false;
    this.locked = false;
    this.touch = false;
    this.sens = 0.0021;
    this.touchSens = 0.0040;
    this.onPause = null;
    this._bindKeys();
    this._bindMouse();
    this._bindTouch();
  }

  get isTouchDevice() {
    return (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
           !window.matchMedia('(pointer:fine)').matches;
  }

  _bindKeys() {
    const down = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.reload = true;
      if (e.code === 'Space') { this.jump = true; e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && this.onPause) this.onPause();
    };
    const up = (e) => this.keys.delete(e.code);
    addEventListener('keydown', down, { passive: false });
    addEventListener('keyup', up);
    addEventListener('blur', () => { this.keys.clear(); this.fire = false; });
  }

  _bindMouse() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.ads = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x -= e.movementX * this.sens;
      this.look.y -= e.movementY * this.sens;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked) { this.fire = false; this.ads = false; }
    });
  }

  requestLock() {
    if (this.isTouchDevice) return;
    const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
  }

  _bindTouch() {
    this.touch = this.isTouchDevice;
    const stick = document.getElementById('stick');
    const base = document.getElementById('stickbase');
    const nub = document.getElementById('sticknub');
    const lookPad = document.getElementById('look');
    let sid = null, ox = 0, oy = 0;
    const R = 46;

    const stickStart = (e) => {
      const t = e.changedTouches[0];
      sid = t.identifier; ox = t.clientX; oy = t.clientY;
      const r = stick.getBoundingClientRect();
      base.style.left = nub.style.left = (ox - r.left) + 'px';
      base.style.top = nub.style.top = (oy - r.top) + 'px';
      base.style.opacity = '.75'; nub.style.opacity = '.9';
      e.preventDefault();
    };
    const stickMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        this.move.x = dx / R; this.move.y = -dy / R;
        this.sprint = d > R * 0.82;
        const r = stick.getBoundingClientRect();
        nub.style.left = (ox - r.left + dx) + 'px';
        nub.style.top = (oy - r.top + dy) + 'px';
      }
      e.preventDefault();
    };
    const stickEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        sid = null; this.move.x = this.move.y = 0; this.sprint = false;
        base.style.opacity = nub.style.opacity = '0';
      }
    };
    stick.addEventListener('touchstart', stickStart, { passive: false });
    stick.addEventListener('touchmove', stickMove, { passive: false });
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);

    let lid = null, lx = 0, ly = 0, lmoved = 0, lstart = 0;
    lookPad.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lid = t.identifier; lx = t.clientX; ly = t.clientY; lmoved = 0; lstart = performance.now();
      e.preventDefault();
    }, { passive: false });
    lookPad.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lid) continue;
        const dx = t.clientX - lx, dy = t.clientY - ly;
        lmoved += Math.abs(dx) + Math.abs(dy);
        this.look.x -= dx * this.touchSens;
        this.look.y -= dy * this.touchSens;
        lx = t.clientX; ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lid) continue;
        // A tap on the look pad is a shot, which is how every phone shooter works.
        if (lmoved < 14 && performance.now() - lstart < 260) {
          this.fire = true; setTimeout(() => { this.fire = false; }, 110);
        }
        lid = null;
      }
    };
    lookPad.addEventListener('touchend', lookEnd);
    lookPad.addEventListener('touchcancel', lookEnd);

    const hold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { el.classList.add('dn'); on(); e.preventDefault(); }, { passive: false });
      const end = (e) => { el.classList.remove('dn'); if (off) off(); if (e) e.preventDefault(); };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    };
    hold('bfire', () => { this.fire = true; }, () => { this.fire = false; });
    hold('bads', () => { this.ads = !this.ads; document.getElementById('bads').classList.toggle('dn', this.ads); }, null);
    hold('brel', () => { this.reload = true; });
    hold('bjump', () => { this.jump = true; });
    hold('bcrouch', () => { this.crouch = !this.crouch; document.getElementById('bcrouch').classList.toggle('dn', this.crouch); }, null);
    hold('bsprint', () => { this.sprintLatch = !this.sprintLatch; document.getElementById('bsprint').classList.toggle('dn', this.sprintLatch); }, null);
  }

  /** Called once per frame, before movement. Returns and clears the look delta. */
  sample(dt) {
    if (!this.touch) {
      const k = this.keys;
      let x = 0, y = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
      if (k.has('KeyA')) x -= 1;
      if (k.has('KeyD')) x += 1;
      const m = Math.hypot(x, y) || 1;
      this.move.x = x / m; this.move.y = y / m;
      // Arrow left/right steer the view. This is what makes the repo's own
      // playtest harness able to drive the game; it holds ArrowUp+ArrowRight.
      this.turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      this.crouch = k.has('KeyC') || k.has('ControlLeft');
    } else {
      this.turn = 0;
      if (this.sprintLatch) this.sprint = true;
    }
    const dx = this.look.x + this.turn * 2.1 * dt;
    const dy = this.look.y;
    this.look.x = 0; this.look.y = 0;
    return { x: dx, y: dy };
  }

  consumeJump() { const j = this.jump; this.jump = false; return j; }
  consumeReload() { const r = this.reload; this.reload = false; return r; }
}
