// Construction des maillages de chunk : élimination des faces cachées,
// occlusion ambiante par sommet, groupes opaque / découpe / eau / lumineux.
(function (MC) {
  'use strict';

  const CW = 16;
  // Faces : normale, 4 sommets (ordre anti-horaire vu de l'extérieur), uv associés
  const FACES = [
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.8, texIdx: 2 },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.8, texIdx: 2 },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 1.0, texIdx: 0 },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.5, texIdx: 1 },
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.7, texIdx: 2 },
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.7, texIdx: 2 }
  ];

  const COLS = MC.ATLAS_COLS, ROWS = MC.ATLAS_ROWS;

  // Tampons typés extensibles : évite les tableaux JS et permet le transfert vers/depuis un Web Worker
  class Buf {
    constructor(Type, cap) { this.Type = Type; this.a = new Type(cap); this.n = 0; }
    grow(extra) {
      if (this.n + extra <= this.a.length) return;
      let cap = this.a.length * 2; while (cap < this.n + extra) cap *= 2;
      const b = new this.Type(cap); b.set(this.a.subarray(0, this.n)); this.a = b;
    }
    push3(x, y, z) { this.grow(3); this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; }
    push2(x, y) { this.grow(2); this.a[this.n++] = x; this.a[this.n++] = y; }
    push6(a, b, c, d, e, f) { this.grow(6); const A = this.a; let n = this.n; A[n++] = a; A[n++] = b; A[n++] = c; A[n++] = d; A[n++] = e; A[n++] = f; this.n = n; }
    done() { return this.a.slice(0, this.n); }
  }
  function makeGroup() { return { pos: new Buf(Float32Array, 3 * 1024), norm: new Buf(Float32Array, 3 * 1024), uv: new Buf(Float32Array, 2 * 1024), col: new Buf(Float32Array, 3 * 1024), idx: new Buf(Uint32Array, 1536) }; }
  function finish(groups) {
    const out = {};
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      out[k] = { pos: g.pos.done(), norm: g.norm.done(), uv: g.uv.done(), col: g.col.done(), idx: g.idx.done() };
    }
    return out;
  }

  function meshChunk(world, chunk) {
    const groups = { opaque: makeGroup(), cutout: makeGroup(), water: makeGroup(), glow: makeGroup() };
    const CH = MC.CH;
    const x0 = chunk.cx * CW, z0 = chunk.cz * CW;
    const data = chunk.data;
    const BLOCKS = MC.BLOCKS;

    // lecture rapide avec repli sur le monde pour les bordures
    const get = (x, y, z) => {
      if (x >= 0 && x < CW && z >= 0 && z < CW && y >= 0 && y < CH) return data[(y * CW + z) * CW + x];
      return world.getBlockOrUnknown(x0 + x, y, z0 + z);
    };
    const opaque = (id) => id === -1 || (id > 0 && !BLOCKS[id].transparent);

    for (let y = 0; y < CH; y++) {
      for (let z = 0; z < CW; z++) {
        for (let x = 0; x < CW; x++) {
          const id = data[(y * CW + z) * CW + x];
          if (id === 0) continue;
          const b = BLOCKS[id];
          if (!b) continue;
          let group;
          if (b.liquid) group = groups.water;
          else if (b.light) group = groups.glow;
          else if (b.cutout) group = groups.cutout;
          else group = groups.opaque;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            const nid = get(nx, ny, nz);
            if (nid === -1) continue;                       // chunk voisin non chargé : on attend
            const nb = BLOCKS[nid];
            let visible;
            if (nid === 0) visible = true;
            else if (b.liquid) visible = !nb.liquid && nb.transparent;
            else if (b.transparent) visible = nb.transparent && nid !== id;
            else visible = nb.transparent;
            if (!visible) continue;

            const tex = b.tex[face.texIdx];
            const tcol = tex % COLS, trow = Math.floor(tex / COLS);
            const base = group.pos.n / 3;
            const aos = [0, 0, 0, 0];
            const topWater = b.liquid && f === 2;
            const lowerWater = b.liquid && get(x, y + 1, z) !== id;

            for (let i = 0; i < 4; i++) {
              const c = face.v[i];
              let vy = y + c[1];
              if (lowerWater && c[1] === 1) vy = y + 0.875;
              group.pos.push3(x0 + x + c[0], vy, z0 + z + c[2]);
              group.norm.push3(face.n[0], face.n[1], face.n[2]);
              const u = (tcol + face.uv[i][0]) / COLS;
              const v = 1 - (trow + 1 - face.uv[i][1]) / ROWS;
              group.uv.push2(u, v);
              // Occlusion ambiante
              let ao = 3;
              if (!b.liquid && !b.light) {
                const tx = face.n[0] !== 0 ? 0 : (c[0] ? 1 : -1);
                const ty = face.n[1] !== 0 ? 0 : (c[1] ? 1 : -1);
                const tz = face.n[2] !== 0 ? 0 : (c[2] ? 1 : -1);
                let s1, s2, cr;
                if (face.n[0] !== 0) { s1 = opaque(get(nx, ny + ty, nz)); s2 = opaque(get(nx, ny, nz + tz)); cr = opaque(get(nx, ny + ty, nz + tz)); }
                else if (face.n[1] !== 0) { s1 = opaque(get(nx + tx, ny, nz)); s2 = opaque(get(nx, ny, nz + tz)); cr = opaque(get(nx + tx, ny, nz + tz)); }
                else { s1 = opaque(get(nx + tx, ny, nz)); s2 = opaque(get(nx, ny + ty, nz)); cr = opaque(get(nx + tx, ny + ty, nz)); }
                ao = (s1 && s2) ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (cr ? 1 : 0));
              }
              aos[i] = ao;
              const light = (topWater ? 1.0 : face.shade) * (0.55 + ao * 0.15);
              group.col.push3(light, light, light);
            }
            // Choix de la diagonale pour une AO lisse
            if (aos[0] + aos[2] > aos[1] + aos[3]) {
              group.idx.push6(base, base + 1, base + 2, base, base + 2, base + 3);
            } else {
              group.idx.push6(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            }
          }
        }
      }
    }
    return finish(groups);
  }

  // Liste des tampons transférables d'un résultat de maillage
  function transferables(groups) {
    const list = [];
    for (const k of Object.keys(groups)) for (const b of Object.keys(groups[k])) list.push(groups[k][b].buffer);
    return list;
  }

  MC.meshChunk = meshChunk;
  MC.meshTransferables = transferables;
})(typeof window !== 'undefined' ? (window.MC = window.MC || {}) : (module.exports = {}));
