import { clamp } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      mag: document.getElementById('mag'), res: document.getElementById('res'),
      ammo: document.getElementById('ammo'), wname: document.getElementById('wname'),
      hp: document.getElementById('hpfill'),
      objs: document.getElementById('objs'), objc: document.getElementById('objc'),
      dmg: document.getElementById('dmg'), flash: document.getElementById('flash'),
      cross: document.getElementById('cross'), hitmark: document.getElementById('hitmark'),
      toast: document.getElementById('toast'), perf: document.getElementById('perf'),
      touch: document.getElementById('touch'),
    };
    this.dmgT = 0; this.hitT = 0; this.toastT = 0; this.flashT = 0;
    this.crossSpread = 0;
  }
  show(on) { this.el.hud.classList.toggle('on', !!on); }
  showTouch(on) { this.el.touch.classList.toggle('on', !!on); }
  showPerf(on) { this.el.perf.classList.toggle('on', !!on); }

  setAmmo(m, r) {
    this.el.mag.textContent = m; this.el.res.textContent = r;
    this.el.ammo.classList.toggle('low', m <= 6);
  }
  setWeapon(n) { this.el.wname.textContent = n; }
  setHp(v) { this.el.hp.style.width = clamp(v, 0, 100) + '%';
    this.el.hp.style.background = v < 34 ? '#d8342a' : v < 66 ? '#d6a41f' : '#cfd4d8'; }
  setObjective(s, c) { this.el.objs.textContent = s; this.el.objc.textContent = c || ''; }
  damage() { this.dmgT = 0.75; }
  hitmark(head) { this.hitT = 0.24; this.el.hitmark.style.filter = head ? 'drop-shadow(0 0 3px #d8342a)' : 'none'; }
  muzzle() { this.flashT = 0.05; }
  toast(t) { this.el.toast.textContent = t; this.toastT = 2.2; }

  update(dt, spread, adsT) {
    this.dmgT = Math.max(0, this.dmgT - dt);
    this.el.dmg.style.opacity = (this.dmgT / 0.75) * 0.5;
    this.hitT = Math.max(0, this.hitT - dt);
    this.el.hitmark.style.opacity = this.hitT > 0 ? clamp(this.hitT / 0.24, 0, 1) : 0;
    this.el.hitmark.style.transform = `rotate(45deg) scale(${1 + (1 - this.hitT / 0.24) * 0.55})`;
    this.flashT = Math.max(0, this.flashT - dt);
    this.el.flash.style.opacity = this.flashT > 0 ? 0.045 : 0;
    this.toastT = Math.max(0, this.toastT - dt);
    this.el.toast.style.opacity = clamp(this.toastT, 0, 1);
    const px = 4 + spread * 620;
    this.crossSpread += (px - this.crossSpread) * Math.min(1, dt * 16);
    const s = this.crossSpread;
    const c = this.el.cross;
    c.style.opacity = adsT > 0.7 ? 0 : 1;
    c.children[0].style.left = -s + 'px'; c.children[1].style.right = -s + 'px';
    c.children[2].style.top = -s + 'px'; c.children[3].style.bottom = -s + 'px';
  }
  perf(txt) { this.el.perf.innerHTML = txt; }
}
