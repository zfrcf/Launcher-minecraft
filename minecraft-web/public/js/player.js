// Joueur : physique (gravité, collisions AABB, nage, vol), entrées, lancer de rayon.
(function (MC) {
  'use strict';

  const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62;
  const GRAVITY = 28, JUMP = 8.6;
  const WALK = 4.3, SPRINT = 5.8, SNEAK = 1.4, FLY = 10.5, FLY_SPRINT = 22;
  const EPS = 0.001;

  class Player {
    constructor(world) {
      this.world = world;
      this.pos = { x: 0, y: 40, z: 0 };
      this.vel = { x: 0, y: 0, z: 0 };
      this.yaw = 0; this.pitch = 0;
      this.onGround = false; this.inWater = false; this.headInWater = false;
      this.flying = false;
      this.mode = 'survival';
      this.autoJump = false;
      this.input = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false, ax: 0, az: 0 };
      this.lastJumpPress = 0;
      this.jumpWasDown = false;
    }

    get eye() { return { x: this.pos.x, y: this.pos.y + (this.input.sneak && !this.flying ? EYE - 0.3 : EYE), z: this.pos.z }; }

    direction() {
      const cp = Math.cos(this.pitch);
      return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
    }

    collides() {
      const w = this.world;
      const x0 = Math.floor(this.pos.x - HALF), x1 = Math.floor(this.pos.x + HALF);
      const y0 = Math.floor(this.pos.y), y1 = Math.floor(this.pos.y + HEIGHT - EPS);
      const z0 = Math.floor(this.pos.z - HALF), z1 = Math.floor(this.pos.z + HALF);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        if (w.isSolidAt(x, y, z)) return true;
      }
      return false;
    }

    // Vrai si le bloc (bx,by,bz) chevauche le joueur
    intersectsBlock(bx, by, bz) {
      return bx + 1 > this.pos.x - HALF && bx < this.pos.x + HALF &&
        by + 1 > this.pos.y && by < this.pos.y + HEIGHT &&
        bz + 1 > this.pos.z - HALF && bz < this.pos.z + HALF;
    }

    moveAxis(axis, delta) {
      if (delta === 0) return false;
      const before = this.pos[axis];
      this.pos[axis] += delta;
      if (!this.collides()) return false;
      // Résolution : on colle au bord du bloc rencontré
      if (axis === 'y') {
        if (delta < 0) { this.pos.y = Math.floor(this.pos.y) + 1 + EPS; }
        else { this.pos.y = Math.floor(this.pos.y + HEIGHT) - HEIGHT - EPS; }
      } else {
        if (delta > 0) this.pos[axis] = Math.floor(this.pos[axis] + HALF) - HALF - EPS;
        else this.pos[axis] = Math.floor(this.pos[axis] - HALF) + 1 + HALF + EPS;
      }
      if (this.collides()) this.pos[axis] = before;
      return true;
    }

    update(dt) {
      dt = Math.min(dt, 0.05);
      const w = this.world, inp = this.input;
      const feetId = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
      const eyeId = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
      this.inWater = MC.isLiquid(feetId) || MC.isLiquid(eyeId);
      this.headInWater = MC.isLiquid(eyeId);

      // Double appui sur saut = vol (créatif)
      if (inp.jump && !this.jumpWasDown) {
        const now = performance.now();
        if (this.mode === 'creative' && now - this.lastJumpPress < 300) { this.flying = !this.flying; this.vel.y = 0; }
        this.lastJumpPress = now;
      }
      this.jumpWasDown = inp.jump;
      if (this.mode !== 'creative') this.flying = false;

      // Direction souhaitée dans le plan horizontal
      let ax = inp.ax, az = inp.az;
      if (inp.forward) az -= 1; if (inp.back) az += 1;
      if (inp.left) ax -= 1; if (inp.right) ax += 1;
      const len = Math.hypot(ax, az);
      if (len > 1) { ax /= len; az /= len; }
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = ax * cos - az * sin;
      const dz = ax * sin + az * cos;

      let speed = WALK;
      if (this.flying) speed = inp.sprint ? FLY_SPRINT : FLY;
      else if (inp.sneak) speed = SNEAK;
      else if (inp.sprint && az < 0) speed = SPRINT;
      if (this.inWater && !this.flying) speed *= 0.55;

      const targetX = dx * speed, targetZ = dz * speed;
      const accel = this.flying ? 8 : (this.onGround ? 14 : (this.inWater ? 6 : 3));
      const k = Math.min(1, accel * dt);
      this.vel.x += (targetX - this.vel.x) * k;
      this.vel.z += (targetZ - this.vel.z) * k;

      if (this.flying) {
        let ty = 0;
        if (inp.jump) ty += speed; if (inp.sneak) ty -= speed;
        this.vel.y += (ty - this.vel.y) * Math.min(1, 10 * dt);
      } else if (this.inWater) {
        this.vel.y -= 6 * dt;
        if (this.vel.y < -3) this.vel.y = -3;
        if (inp.jump) this.vel.y = Math.min(this.vel.y + 24 * dt, 3.2);
      } else {
        this.vel.y -= GRAVITY * dt;
        if (this.vel.y < -60) this.vel.y = -60;
        if (inp.jump && this.onGround) { this.vel.y = JUMP; this.onGround = false; }
      }

      // Déplacement par sous-étapes pour éviter de traverser les blocs
      const total = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt;
      const steps = Math.max(1, Math.ceil(total / 0.25));
      const sdt = dt / steps;
      let hitGround = false;
      for (let s = 0; s < steps; s++) {
        const hx = this.moveAxis('x', this.vel.x * sdt);
        const hz = this.moveAxis('z', this.vel.z * sdt);
        if ((hx || hz) && this.autoJump && this.onGround && !this.flying) this.tryStepUp(hx ? this.vel.x * sdt : 0, hz ? this.vel.z * sdt : 0);
        if (hx) this.vel.x = 0;
        if (hz) this.vel.z = 0;
        const hy = this.moveAxis('y', this.vel.y * sdt);
        if (hy) { if (this.vel.y < 0) hitGround = true; this.vel.y = 0; }
      }
      this.onGround = hitGround || (this.vel.y <= 0 && this.probeGround());
      if (this.pos.y < -20) { this.pos.y = MC.CH; this.vel.y = 0; }
    }

    probeGround() {
      this.pos.y -= 0.02;
      const c = this.collides();
      this.pos.y += 0.02;
      return c;
    }

    tryStepUp(dx, dz) {
      const save = { ...this.pos };
      this.pos.y += 1.0;
      if (this.collides()) { this.pos = save; return; }
      this.pos.x += dx; this.pos.z += dz;
      if (this.collides()) { this.pos = save; return; }
      // on redescend au sol
      this.pos.y -= 0.02;
      if (!this.collides()) { this.pos.y += 0.02; }
      this.vel.y = 0;
    }

    teleport(x, y, z) { this.pos.x = x; this.pos.y = y; this.pos.z = z; this.vel.x = this.vel.y = this.vel.z = 0; }
  }

  // Lancer de rayon voxel (DDA). Renvoie { x,y,z, nx,ny,nz, id, dist } ou null
  function raycast(world, origin, dir, maxDist, hitLiquid) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
    let tmx = (dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tdx;
    let tmy = (dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tdy;
    let tmz = (dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tdz;
    let nx = 0, ny = 0, nz = 0, dist = 0;
    for (let i = 0; i < 200; i++) {
      const id = world.getBlock(x, y, z);
      if (id !== 0 && (hitLiquid || !MC.isLiquid(id))) return { x, y, z, nx, ny, nz, id, dist };
      if (tmx < tmy && tmx < tmz) { x += stepX; dist = tmx; tmx += tdx; nx = -stepX; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += stepY; dist = tmy; tmy += tdy; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; dist = tmz; tmz += tdz; nx = 0; ny = 0; nz = -stepZ; }
      if (dist > maxDist) return null;
    }
    return null;
  }

  MC.Player = Player;
  MC.raycast = raycast;
  MC.PLAYER_HEIGHT = HEIGHT; MC.PLAYER_EYE = EYE; MC.PLAYER_HALF = HALF;
})(typeof window !== 'undefined' ? (window.MC = window.MC || {}) : (module.exports = {}));
