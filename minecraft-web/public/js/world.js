// Monde voxel : chunks, génération procédurale, modifications (edits) synchronisées.
(function (MC) {
  'use strict';

  const CW = 16;        // largeur/profondeur d'un chunk
  const CH = 96;        // hauteur du monde
  const SEA = 34;       // niveau de la mer

  function idx(x, y, z) { return (y * CW + z) * CW + x; }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.data = new Uint8Array(CW * CH * CW);
      this.dirty = true;
      this.mesh = null;   // rempli par le rendu
      this.generated = false;
    }
    get(x, y, z) { return this.data[idx(x, y, z)]; }
    set(x, y, z, id) { this.data[idx(x, y, z)] = id; }
  }

  class World {
    constructor(seed) {
      this.seed = seed | 0;
      this.chunks = new Map();
      this.edits = new Map();       // "x,y,z" -> id (modifs par rapport au terrain généré)
      this.noise = new MC.SimplexNoise(this.seed);
      this.noise2 = new MC.SimplexNoise(this.seed ^ 0x5bd1e995);
      this.noise3 = new MC.SimplexNoise(this.seed ^ 0x27d4eb2f);
      this.heightCache = new Map();
      this.onChunkDirty = null;
      this.onBlockSet = null;
    }

    static key(cx, cz) { return cx + ',' + cz; }

    // ---------- Génération ----------
    terrainHeight(x, z) {
      const k = (x + 1048576) * 4194304 + (z + 1048576);
      const cached = this.heightCache.get(k);
      if (cached !== undefined) return cached;
      const n = this.noise;
      const continental = n.fbm2D(x * 0.0022, z * 0.0022, 3, 2.1, 0.5);
      const hills = n.fbm2D(x * 0.009 + 31.7, z * 0.009 - 12.3, 5, 2.0, 0.5);
      let mountain = this.noise2.noise2D(x * 0.0035, z * 0.0035);
      mountain = Math.max(0, mountain - 0.15);
      mountain = mountain * mountain * 2.4;
      let h = SEA + 2 + continental * 12 + hills * 11 + mountain * 55;
      h = Math.round(Math.max(6, Math.min(CH - 6, h)));
      if (this.heightCache.size > 200000) this.heightCache.clear();
      this.heightCache.set(k, h);
      return h;
    }

    isDesert(x, z) { return this.noise3.noise2D(x * 0.0018 + 500, z * 0.0018 + 500) > 0.42; }
    isSnowy(x, z, h) { return h > 68 || this.noise3.noise2D(x * 0.0015 - 900, z * 0.0015 + 300) > 0.55; }

    isCave(x, y, z) {
      if (y < 4) return false;
      const a = this.noise2.noise3D(x * 0.065, y * 0.075, z * 0.065);
      if (a > 0.58) return true;
      const b = this.noise3.noise3D(x * 0.03 + 7, y * 0.05, z * 0.03 + 7);
      return Math.abs(b) < 0.045 && y < 60;
    }

    oreAt(x, y, z) {
      const h = MC.hash3(x, y, z, this.seed + 91);
      if (y < 14 && h < 0.0012) return 16;   // diamant
      if (y < 26 && h < 0.0034) return 15;   // or
      if (y < 44 && h < 0.0100) return 14;   // fer
      if (y < 72 && h < 0.0200) return 13;   // charbon
      if (h > 0.985 && y < 50) return 18;    // poches de gravier
      if (h > 0.975 && y < 50) return 2;     // poches de terre
      return 3;
    }

    treeAt(x, z) {
      const h = this.terrainHeight(x, z);
      if (h <= SEA + 1) return null;
      if (this.isDesert(x, z)) return null;
      const r = MC.hash3(x, 0, z, this.seed + 77);
      if (r > 0.0085) return null;
      const trunk = 4 + Math.floor(MC.hash3(x, 1, z, this.seed + 78) * 3);
      return { x, z, base: h + 1, trunk, snowy: this.isSnowy(x, z, h) };
    }

    cactusAt(x, z) {
      const h = this.terrainHeight(x, z);
      if (h <= SEA + 1 || !this.isDesert(x, z)) return null;
      const r = MC.hash3(x, 2, z, this.seed + 79);
      if (r > 0.004) return null;
      return { x, z, base: h + 1, height: 2 + Math.floor(MC.hash3(x, 3, z, this.seed + 80) * 2) };
    }

    generateChunk(chunk) {
      const cx = chunk.cx, cz = chunk.cz;
      const d = chunk.data;
      const x0 = cx * CW, z0 = cz * CW;
      for (let lx = 0; lx < CW; lx++) {
        for (let lz = 0; lz < CW; lz++) {
          const wx = x0 + lx, wz = z0 + lz;
          const h = this.terrainHeight(wx, wz);
          const desert = this.isDesert(wx, wz);
          const snowy = this.isSnowy(wx, wz, h);
          const beach = h <= SEA + 1;
          for (let y = 0; y < CH; y++) {
            let id = 0;
            if (y === 0) id = 11;
            else if (y <= h) {
              if (y < 3 && MC.hash3(wx, y, wz, this.seed) < 0.4) id = 11;
              else if (y === h) {
                if (desert || beach) id = 6;
                else if (snowy) id = 17;
                else id = 1;
              } else if (y >= h - 3) {
                id = (desert || beach) ? (y >= h - 2 ? 6 : 3) : 2;
              } else id = this.oreAt(wx, y, wz);
              if (id !== 11 && y > 2 && y < h - 1 && this.isCave(wx, y, wz)) id = 0;
              // pas de grottes qui percent sous la mer
              if (id === 0 && y <= SEA && h <= SEA + 2) id = 3;
            } else if (y <= SEA) id = 7;
            d[idx(lx, y, lz)] = id;
          }
        }
      }
      // Arbres & cactus (y compris ceux des colonnes voisines qui débordent)
      for (let wx = x0 - 3; wx < x0 + CW + 3; wx++) {
        for (let wz = z0 - 3; wz < z0 + CW + 3; wz++) {
          if (MC.hash3(wx, 0, wz, this.seed + 77) <= 0.0085) {
            const t = this.treeAt(wx, wz);
            if (t) this.stampTree(chunk, t);
          } else if (MC.hash3(wx, 2, wz, this.seed + 79) <= 0.004) {
            const c = this.cactusAt(wx, wz);
            if (c) this.stampCactus(chunk, c);
          }
        }
      }
      // Modifications enregistrées
      for (const [k, id] of this.edits) {
        const p = k.split(',');
        const x = +p[0], y = +p[1], z = +p[2];
        if ((x >> 4) === cx && (z >> 4) === cz && y >= 0 && y < CH) d[idx(x & 15, y, z & 15)] = id;
      }
      chunk.generated = true;
    }

    stampLocal(chunk, wx, wy, wz, id, onlyAir) {
      const cx = wx >> 4, cz = wz >> 4;
      if (cx !== chunk.cx || cz !== chunk.cz || wy < 0 || wy >= CH) return;
      const i = idx(wx & 15, wy, wz & 15);
      if (onlyAir && chunk.data[i] !== 0) return;
      chunk.data[i] = id;
    }

    stampTree(chunk, t) {
      for (let i = 0; i < t.trunk; i++) this.stampLocal(chunk, t.x, t.base + i, t.z, 4, false);
      const top = t.base + t.trunk;
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy <= -1 ? 2 : 1;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 0) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 1 || MC.hash3(t.x + dx, top + dy, t.z + dz, this.seed) < 0.5)) continue;
          this.stampLocal(chunk, t.x + dx, top + dy, t.z + dz, 5, true);
        }
      }
      this.stampLocal(chunk, t.x, top + 1, t.z, 5, true);
    }

    stampCactus(chunk, c) {
      for (let i = 0; i < c.height; i++) this.stampLocal(chunk, c.x, c.base + i, c.z, 26, true);
    }

    // ---------- Accès ----------
    getChunk(cx, cz) { return this.chunks.get(World.key(cx, cz)) || null; }

    ensureChunk(cx, cz) {
      const k = World.key(cx, cz);
      let c = this.chunks.get(k);
      if (!c) {
        c = new Chunk(cx, cz);
        this.generateChunk(c);
        this.chunks.set(k, c);
        // les voisins doivent recalculer leurs faces de bordure
        this.markDirty(cx + 1, cz); this.markDirty(cx - 1, cz);
        this.markDirty(cx, cz + 1); this.markDirty(cx, cz - 1);
      }
      return c;
    }

    // Insère un chunk dont les données ont été générées ailleurs (Web Worker)
    addChunk(cx, cz, data) {
      const k = World.key(cx, cz);
      let c = this.chunks.get(k);
      if (c) { c.data = data; c.dirty = true; return c; }
      c = new Chunk(cx, cz);
      c.data = data; c.generated = true;
      this.chunks.set(k, c);
      this.markDirty(cx + 1, cz); this.markDirty(cx - 1, cz);
      this.markDirty(cx, cz + 1); this.markDirty(cx, cz - 1);
      return c;
    }

    // Point d'apparition sans générer de chunk : colonne de terre ferme la plus proche de l'origine
    findSpawnColumn() {
      for (let r = 0; r < 40; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const x = dx * 2, z = dz * 2;
          const h = this.terrainHeight(x, z);
          if (h > SEA + 1 && !this.treeAt(x, z) && !this.cactusAt(x, z)) return { x: x + 0.5, y: h + 1.2, z: z + 0.5 };
        }
      }
      return { x: 0.5, y: this.terrainHeight(0, 0) + 1.2, z: 0.5 };
    }

    unloadChunk(cx, cz) {
      const k = World.key(cx, cz);
      const c = this.chunks.get(k);
      if (c) { this.chunks.delete(k); return c; }
      return null;
    }

    markDirty(cx, cz) {
      const c = this.chunks.get(World.key(cx, cz));
      if (c) { c.dirty = true; if (this.onChunkDirty) this.onChunkDirty(c); }
    }

    getBlock(x, y, z) {
      if (y < 0) return 11;
      if (y >= CH) return 0;
      const c = this.chunks.get(World.key(x >> 4, z >> 4));
      if (!c) return 0;
      return c.data[idx(x & 15, y, z & 15)];
    }

    // Renvoie -1 si le chunk n'est pas chargé (utile pour le maillage)
    getBlockOrUnknown(x, y, z) {
      if (y < 0) return 11;
      if (y >= CH) return 0;
      const c = this.chunks.get(World.key(x >> 4, z >> 4));
      if (!c) return -1;
      return c.data[idx(x & 15, y, z & 15)];
    }

    isSolidAt(x, y, z) { return MC.isSolid(this.getBlock(x, y, z)); }

    // Modifie un bloc. record=true enregistre la modification (pour sync/sauvegarde)
    setBlock(x, y, z, id, record) {
      if (y < 0 || y >= CH) return false;
      const cx = x >> 4, cz = z >> 4;
      const c = this.ensureChunk(cx, cz);
      const lx = x & 15, lz = z & 15;
      const i = idx(lx, y, lz);
      if (c.data[i] === id) return false;
      c.data[i] = id;
      if (record !== false) {
        this.edits.set(x + ',' + y + ',' + z, id);
        if (this.onBlockSet) this.onBlockSet(x, y, z, id);
      }
      c.dirty = true;
      if (this.onChunkDirty) this.onChunkDirty(c);
      if (lx === 0) this.markDirty(cx - 1, cz);
      if (lx === 15) this.markDirty(cx + 1, cz);
      if (lz === 0) this.markDirty(cx, cz - 1);
      if (lz === 15) this.markDirty(cx, cz + 1);
      return true;
    }

    applyEdits(list) {
      for (const e of list) {
        this.edits.set(e[0] + ',' + e[1] + ',' + e[2], e[3]);
        const c = this.getChunk(e[0] >> 4, e[2] >> 4);
        if (c) this.setBlock(e[0], e[1], e[2], e[3], false);
      }
    }

    editsToArray() {
      const out = [];
      for (const [k, id] of this.edits) { const p = k.split(','); out.push([+p[0], +p[1], +p[2], id]); }
      return out;
    }

    // Colonne libre la plus haute (pour le spawn)
    surfaceY(x, z) {
      for (let y = CH - 1; y > 0; y--) {
        const id = this.getBlock(x, y, z);
        if (id !== 0 && id !== 7) return y + 1;
      }
      return SEA + 1;
    }

    // Fait tomber sable/gravier après retrait d'un bloc. Renvoie la liste des changements.
    settleGravity(x, y, z) {
      const changes = [];
      let cy = y + 1;
      while (cy < CH) {
        const id = this.getBlock(x, cy, z);
        const b = MC.BLOCKS[id];
        if (!b || !b.gravity) break;
        let ty = cy - 1;
        while (ty >= 0) {
          const below = this.getBlock(x, ty, z);
          if (below === 0 || below === 7) ty--; else break;
        }
        ty++;
        if (ty === cy) break;
        this.setBlock(x, cy, z, 0);
        this.setBlock(x, ty, z, id);
        changes.push([x, cy, z, 0], [x, ty, z, id]);
        cy++;
      }
      return changes;
    }
  }

  MC.World = World;
  MC.Chunk = Chunk;
  MC.CW = CW; MC.CH = CH; MC.SEA = SEA;
  MC.blockIndex = idx;
})(typeof window !== 'undefined' ? (window.MC = window.MC || {}) : (module.exports = {}));
