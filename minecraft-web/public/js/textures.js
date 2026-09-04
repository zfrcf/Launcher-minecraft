// Génération procédurale de l'atlas de textures (aucun fichier image externe).
// Chaque tuile fait 16x16 pixels ; l'atlas fait 8 colonnes x 4 lignes.
(function (MC) {
  'use strict';

  const TILE = 16;
  const COLS = 8, ROWS = 4;

  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  // Remplit une tuile avec une couleur de base et une variance aléatoire
  function fill(img, ox, oy, rgb, variance, rnd, alpha) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const v = (rnd() - 0.5) * 2 * variance;
        setPx(img, ox + x, oy + y, rgb[0] + v, rgb[1] + v, rgb[2] + v, alpha === undefined ? 255 : alpha);
      }
    }
  }

  function setPx(img, x, y, r, g, b, a) {
    const i = (y * img.width + x) * 4;
    img.data[i] = clamp(r); img.data[i + 1] = clamp(g); img.data[i + 2] = clamp(b); img.data[i + 3] = clamp(a === undefined ? 255 : a);
  }

  function speckle(img, ox, oy, rgb, count, rnd, size) {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rnd() * TILE), y = Math.floor(rnd() * TILE);
      const s = size || 1;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const px = (x + dx) % TILE, py = (y + dy) % TILE;
        const v = (rnd() - 0.5) * 20;
        setPx(img, ox + px, oy + py, rgb[0] + v, rgb[1] + v, rgb[2] + v);
      }
    }
  }

  function oreTile(img, ox, oy, oreRgb, rnd) {
    fill(img, ox, oy, [125, 125, 125], 12, rnd);
    speckle(img, ox, oy, [100, 100, 100], 6, rnd, 2);
    // 4-5 pépites de 2x2
    const n = 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const x = 1 + Math.floor(rnd() * 12), y = 1 + Math.floor(rnd() * 12);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const v = (rnd() - 0.5) * 30;
        setPx(img, ox + x + dx, oy + y + dy, oreRgb[0] + v, oreRgb[1] + v, oreRgb[2] + v);
      }
      setPx(img, ox + x + 2, oy + y, oreRgb[0] - 40, oreRgb[1] - 40, oreRgb[2] - 40);
    }
  }

  function woolTile(img, ox, oy, rgb, rnd) {
    fill(img, ox, oy, rgb, 10, rnd);
    for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x++) {
      if ((x + y) % 3 === 0) setPx(img, ox + x, oy + y, rgb[0] - 18, rgb[1] - 18, rgb[2] - 18);
    }
  }

  const PAINTERS = {};
  const T = MC.TEX;

  PAINTERS[T.GRASS_TOP] = (img, ox, oy, rnd) => { fill(img, ox, oy, [96, 160, 56], 16, rnd); speckle(img, ox, oy, [120, 185, 70], 20, rnd); };
  PAINTERS[T.DIRT] = (img, ox, oy, rnd) => { fill(img, ox, oy, [134, 96, 67], 14, rnd); speckle(img, ox, oy, [110, 78, 52], 14, rnd, 2); };
  PAINTERS[T.GRASS_SIDE] = (img, ox, oy, rnd) => {
    PAINTERS[T.DIRT](img, ox, oy, rnd);
    for (let x = 0; x < TILE; x++) {
      const depth = 2 + Math.floor(rnd() * 3);
      for (let y = 0; y < depth; y++) {
        const v = (rnd() - 0.5) * 24;
        setPx(img, ox + x, oy + y, 96 + v, 160 + v, 56 + v);
      }
    }
  };
  PAINTERS[T.SNOW_SIDE] = (img, ox, oy, rnd) => {
    PAINTERS[T.DIRT](img, ox, oy, rnd);
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < depth; y++) { const v = (rnd() - 0.5) * 10; setPx(img, ox + x, oy + y, 240 + v, 248 + v, 250 + v); }
    }
  };
  PAINTERS[T.STONE] = (img, ox, oy, rnd) => { fill(img, ox, oy, [125, 125, 125], 12, rnd); speckle(img, ox, oy, [100, 100, 100], 8, rnd, 2); };
  PAINTERS[T.LOG_SIDE] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [104, 82, 50], 10, rnd);
    for (let x = 0; x < TILE; x++) {
      if (x % 4 === 0 || x % 7 === 0) for (let y = 0; y < TILE; y++) { const v = (rnd() - 0.5) * 10; setPx(img, ox + x, oy + y, 78 + v, 60 + v, 36 + v); }
    }
  };
  PAINTERS[T.LOG_TOP] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [104, 82, 50], 8, rnd);
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const ring = Math.floor(d) % 2 === 0;
      const c = ring ? [170, 140, 90] : [140, 112, 70];
      const v = (rnd() - 0.5) * 12;
      setPx(img, ox + x, oy + y, c[0] + v, c[1] + v, c[2] + v);
    }
  };
  PAINTERS[T.LEAVES] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [58, 122, 34], 20, rnd);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (rnd() < 0.12) setPx(img, ox + x, oy + y, 0, 0, 0, 0);
      else if (rnd() < 0.15) setPx(img, ox + x, oy + y, 80, 150, 50);
    }
  };
  PAINTERS[T.SAND] = (img, ox, oy, rnd) => { fill(img, ox, oy, [219, 207, 163], 10, rnd); speckle(img, ox, oy, [200, 188, 140], 12, rnd); };
  PAINTERS[T.WATER] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [52, 100, 210], 14, rnd, 255);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (((x + y * 3) % 11) === 0) setPx(img, ox + x, oy + y, 90, 140, 240);
    }
  };
  PAINTERS[T.PLANKS] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [188, 152, 98], 10, rnd);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (y % 4 === 3) setPx(img, ox + x, oy + y, 120, 92, 55);
      else if ((y < 4 && x === 3) || (y >= 4 && y < 8 && x === 11) || (y >= 8 && y < 12 && x === 6) || (y >= 12 && x === 13)) setPx(img, ox + x, oy + y, 130, 100, 60);
    }
  };
  PAINTERS[T.COBBLE] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [118, 118, 118], 16, rnd);
    // cellules de pierre
    const cells = [[0, 0, 6, 5], [6, 0, 10, 4], [10, 0, 16, 6], [0, 5, 4, 10], [4, 4, 10, 9], [10, 6, 16, 11], [0, 10, 7, 16], [7, 9, 12, 16], [12, 11, 16, 16]];
    cells.forEach((c) => {
      const base = 100 + rnd() * 50;
      for (let y = c[1]; y < c[3]; y++) for (let x = c[0]; x < c[2]; x++) {
        const edge = x === c[0] || y === c[1] || x === c[2] - 1 || y === c[3] - 1;
        const v = (rnd() - 0.5) * 14;
        const g = edge ? base - 45 : base;
        setPx(img, ox + x, oy + y, g + v, g + v, g + v);
      }
    });
  };
  PAINTERS[T.GLASS] = (img, ox, oy, rnd) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      if (edge) setPx(img, ox + x, oy + y, 200, 230, 240, 255);
      else if ((x === y + 2 || x === y + 3) && x < 9) setPx(img, ox + x, oy + y, 230, 245, 250, 255);
      else setPx(img, ox + x, oy + y, 200, 230, 240, 0);
    }
  };
  PAINTERS[T.BEDROCK] = (img, ox, oy, rnd) => { fill(img, ox, oy, [70, 70, 70], 35, rnd); };
  PAINTERS[T.BRICK] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [150, 70, 60], 12, rnd);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const row = Math.floor(y / 4);
      const offset = row % 2 === 0 ? 0 : 4;
      if (y % 4 === 3 || (x + offset) % 8 === 7) setPx(img, ox + x, oy + y, 190, 180, 170);
    }
  };
  PAINTERS[T.COAL] = (img, ox, oy, rnd) => oreTile(img, ox, oy, [35, 35, 35], rnd);
  PAINTERS[T.IRON] = (img, ox, oy, rnd) => oreTile(img, ox, oy, [216, 175, 147], rnd);
  PAINTERS[T.GOLD] = (img, ox, oy, rnd) => oreTile(img, ox, oy, [250, 220, 70], rnd);
  PAINTERS[T.DIAMOND] = (img, ox, oy, rnd) => oreTile(img, ox, oy, [90, 230, 225], rnd);
  PAINTERS[T.SNOW] = (img, ox, oy, rnd) => { fill(img, ox, oy, [242, 250, 252], 6, rnd); };
  PAINTERS[T.GRAVEL] = (img, ox, oy, rnd) => { fill(img, ox, oy, [128, 122, 118], 22, rnd); speckle(img, ox, oy, [90, 85, 80], 10, rnd, 2); speckle(img, ox, oy, [170, 165, 160], 8, rnd, 2); };
  PAINTERS[T.CRAFT_TOP] = (img, ox, oy, rnd) => {
    PAINTERS[T.PLANKS](img, ox, oy, rnd);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      if (x === 1 || y === 1 || x === 14 || y === 14 || x === 8 || y === 8) setPx(img, ox + x, oy + y, 70, 50, 30);
      else if ((x < 8) === (y < 8)) setPx(img, ox + x, oy + y, 200, 170, 120);
    }
  };
  PAINTERS[T.CRAFT_SIDE] = (img, ox, oy, rnd) => {
    PAINTERS[T.PLANKS](img, ox, oy, rnd);
    for (let x = 0; x < TILE; x++) setPx(img, ox + x, oy + 2, 90, 65, 40);
    // outils : scie et marteau stylisés
    for (let y = 5; y < 12; y++) { setPx(img, ox + 4, oy + y, 90, 90, 95); setPx(img, ox + 10, oy + y, 90, 65, 40); }
    for (let x = 3; x < 7; x++) setPx(img, ox + x, oy + 5, 120, 120, 125);
    for (let x = 8, y = 5; x < 13; x++) setPx(img, ox + x, oy + y, 60, 60, 65);
  };
  PAINTERS[T.WOOL_RED] = (img, ox, oy, rnd) => woolTile(img, ox, oy, [170, 45, 40], rnd);
  PAINTERS[T.WOOL_BLUE] = (img, ox, oy, rnd) => woolTile(img, ox, oy, [50, 65, 165], rnd);
  PAINTERS[T.WOOL_YELLOW] = (img, ox, oy, rnd) => woolTile(img, ox, oy, [225, 195, 50], rnd);
  PAINTERS[T.WOOL_WHITE] = (img, ox, oy, rnd) => woolTile(img, ox, oy, [225, 225, 225], rnd);
  PAINTERS[T.GLOWSTONE] = (img, ox, oy, rnd) => { fill(img, ox, oy, [230, 190, 90], 18, rnd); speckle(img, ox, oy, [255, 240, 170], 14, rnd, 2); speckle(img, ox, oy, [180, 130, 50], 8, rnd, 2); };
  PAINTERS[T.OBSIDIAN] = (img, ox, oy, rnd) => { fill(img, ox, oy, [22, 14, 36], 10, rnd); speckle(img, ox, oy, [60, 30, 90], 6, rnd, 2); };
  PAINTERS[T.CACTUS_SIDE] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [60, 140, 50], 12, rnd);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (x % 4 === 1) setPx(img, ox + x, oy + y, 30, 95, 30);
      if (x === 0 || x === 15) setPx(img, ox + x, oy + y, 40, 110, 40);
    }
  };
  PAINTERS[T.CACTUS_TOP] = (img, ox, oy, rnd) => {
    fill(img, ox, oy, [70, 150, 60], 10, rnd);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) setPx(img, ox + x, oy + y, 40, 110, 40);
    }
  };
  PAINTERS[T.BOOKSHELF] = (img, ox, oy, rnd) => {
    PAINTERS[T.PLANKS](img, ox, oy, rnd);
    const colors = [[170, 50, 40], [50, 70, 160], [60, 140, 60], [200, 170, 60], [120, 60, 140], [220, 220, 220]];
    for (let shelf = 0; shelf < 2; shelf++) {
      const y0 = 2 + shelf * 7;
      let x = 1;
      while (x < 15) {
        const w = 1 + Math.floor(rnd() * 2);
        const c = colors[Math.floor(rnd() * colors.length)];
        for (let dx = 0; dx < w && x + dx < 15; dx++) for (let dy = 0; dy < 5; dy++) {
          const v = (rnd() - 0.5) * 16;
          setPx(img, ox + x + dx, oy + y0 + dy, c[0] + v, c[1] + v, c[2] + v);
        }
        x += w + (rnd() < 0.3 ? 1 : 0);
      }
    }
  };

  function createAtlasCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = COLS * TILE; canvas.height = ROWS * TILE;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);
    const rnd = MC.mulberry32(1337);
    for (let i = 0; i < COLS * ROWS; i++) {
      const ox = (i % COLS) * TILE, oy = Math.floor(i / COLS) * TILE;
      const painter = PAINTERS[i];
      if (painter) painter(img, ox, oy, rnd);
      else fill(img, ox, oy, [255, 0, 255], 0, rnd);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Icône pseudo-3D d'un bloc (pour la barre d'outils / inventaire)
  function blockIcon(atlas, id, size) {
    const b = MC.BLOCKS[id];
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!b || !b.tex) return c;
    const tile = (idx) => [(idx % COLS) * TILE, Math.floor(idx / COLS) * TILE];
    const s = size;
    const w = s * 0.5, h = s * 0.29;
    // Face du dessus
    let t = tile(b.tex[0]);
    ctx.save();
    ctx.setTransform(w / TILE, h / TILE, -w / TILE, h / TILE, s / 2, 0.02 * s);
    ctx.drawImage(atlas, t[0], t[1], TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
    // Face gauche
    t = tile(b.tex[2]);
    ctx.save();
    ctx.setTransform(w / TILE, h / TILE, 0, (s * 0.55) / TILE, 0.02 * s, s * 0.3);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(atlas, t[0], t[1], TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
    // Face droite
    ctx.save();
    ctx.setTransform(w / TILE, -h / TILE, 0, (s * 0.55) / TILE, s / 2, s * 0.59);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(atlas, t[0], t[1], TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
    return c;
  }

  MC.createAtlasCanvas = createAtlasCanvas;
  MC.blockIcon = blockIcon;
  MC.TILE = TILE;
})(window.MC = window.MC || {});
