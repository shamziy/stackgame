// Stacking rules, cutting, falling pieces and the perfect-drop ripple. Exposes one global: Game
const SLAB_H = 0.5;       // slab height
const START_SIZE = 3;     // width and depth of the base slab
const SWING_RANGE = 4;    // how far a moving slab swings from centre
const PERFECT_TOL = 0.08; // overlap tolerance that counts as a perfect drop
const RIPPLE_TIME = 0.55; // seconds a perfect-drop ripple lives

class Game {
  constructor(scene, hooks) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.hooks = hooks;
    this.reset();
  }

  get height() { return this.stack.length * SLAB_H; }
  get top() { return this.stack[this.stack.length - 1]; }

  reset() {
    for (const child of this.group.children.slice()) this.remove(child);
    this.stack = [];
    this.pieces = [];
    this.ripples = [];
    this.moving = null;
    this.score = 0;
    this.combo = 0;
    this.t = 0;
    this.axis = 'x';
    this.state = 'ready';
    const base = this.makeSlab(START_SIZE, START_SIZE, 0, 0, 0, 0);
    this.stack.push({ mesh: base, x: 0, z: 0, w: START_SIZE, d: START_SIZE });
    this.hooks.onScore(0);
  }

  remove(mesh) {
    this.group.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  color(i) {
    return new THREE.Color().setHSL(((i * 9) % 360) / 360, 0.6, 0.6);
  }

  makeSlab(w, d, x, y, z, i) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, SLAB_H, d),
      new THREE.MeshLambertMaterial({ color: this.color(i) })
    );
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  spawn() {
    const top = this.top;
    const n = this.stack.length;
    this.axis = n % 2 === 1 ? 'x' : 'z';
    this.t = -Math.PI / 2;
    this.moving = this.makeSlab(top.w, top.d, top.x, n * SLAB_H, top.z, n);
    this.moving.position[this.axis] = -SWING_RANGE;
  }

  tap() {
    if (this.state === 'ready') {
      this.state = 'play';
      this.spawn();
    } else if (this.state === 'play') {
      this.place();
    }
  }

  place() {
    const a = this.axis;
    const size = a === 'x' ? 'w' : 'd';
    const other = a === 'x' ? 'd' : 'w';
    const top = this.top;
    const cur = this.moving;
    const pos = cur.position[a];
    const delta = pos - top[a];
    const overlap = top[size] - Math.abs(delta);

    if (overlap <= 0) {
      this.fail();
      return;
    }

    let newSize = top[size];
    let center = pos;
    let perfect = false;

    if (Math.abs(delta) < PERFECT_TOL) {
      perfect = true;
      center = top[a];
      this.combo++;
      if (this.combo >= 3) newSize = Math.min(START_SIZE, newSize + 0.3);
      this.hooks.onPerfect(this.combo);
    } else {
      this.combo = 0;
      newSize = overlap;
      center = top[a] + delta / 2;
      const overCenter = (top[a] + pos) / 2 + (Math.sign(delta) * top[size]) / 2;
      this.dropPiece(a, Math.abs(delta), overCenter, top[other], cur);
      this.hooks.onDrop();
    }

    const rec = { mesh: cur, x: top.x, z: top.z, w: top.w, d: top.d };
    rec[a] = center;
    rec[size] = newSize;
    cur.geometry.dispose();
    cur.geometry = new THREE.BoxGeometry(rec.w, SLAB_H, rec.d);
    cur.position.set(rec.x, cur.position.y, rec.z);

    if (perfect) this.ripple(rec, cur.position.y + SLAB_H / 2 + 0.01);

    this.stack.push(rec);
    this.score++;
    this.hooks.onScore(this.score);
    this.spawn();
  }

  ripple(rec, y) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(rec.x, y, rec.z);
    mesh.scale.set(rec.w, rec.d, 1);
    this.group.add(mesh);
    this.ripples.push({ mesh, age: 0, w: rec.w, d: rec.d });
  }

  dropPiece(a, size, center, otherSize, cur) {
    const w = a === 'x' ? size : otherSize;
    const d = a === 'x' ? otherSize : size;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB_H, d), cur.material.clone());
    mesh.position.set(cur.position.x, cur.position.y, cur.position.z);
    mesh.position[a] = center;
    this.group.add(mesh);
    this.pieces.push({ mesh, vy: 0, spin: (Math.random() - 0.5) * 2, a });
  }

  fail() {
    this.state = 'over';
    this.pieces.push({ mesh: this.moving, vy: 0, spin: 0.8, a: this.axis });
    this.moving = null;
    this.hooks.onOver(this.score);
  }

  update(dt) {
    if (this.state === 'play' && this.moving) {
      const speed = Math.min(1.6 + this.score * 0.04, 4.2); // radians per second
      this.t += speed * dt;
      this.moving.position[this.axis] = Math.sin(this.t) * SWING_RANGE;
    }

    for (const p of this.pieces.slice()) {
      p.vy -= 18 * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.rotation[p.a === 'x' ? 'z' : 'x'] += p.spin * dt;
      if (p.mesh.position.y < this.height - 25) {
        this.remove(p.mesh);
        this.pieces.splice(this.pieces.indexOf(p), 1);
      }
    }

    for (const r of this.ripples.slice()) {
      r.age += dt;
      const k = r.age / RIPPLE_TIME;
      if (k >= 1) {
        this.remove(r.mesh);
        this.ripples.splice(this.ripples.indexOf(r), 1);
      } else {
        const grow = 1 + k * 0.6;
        r.mesh.scale.set(r.w * grow, r.d * grow, 1);
        r.mesh.material.opacity = 0.7 * (1 - k);
      }
    }
  }
}
