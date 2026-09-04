// Définition des blocs. Les indices de texture renvoient aux tuiles de l'atlas
// généré dans textures.js.
(function (MC) {
  'use strict';

  const T = {
    GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, LOG_SIDE: 4, LOG_TOP: 5,
    LEAVES: 6, SAND: 7, WATER: 8, PLANKS: 9, COBBLE: 10, GLASS: 11, BEDROCK: 12,
    BRICK: 13, COAL: 14, IRON: 15, GOLD: 16, DIAMOND: 17, SNOW: 18, GRAVEL: 19,
    CRAFT_TOP: 20, CRAFT_SIDE: 21, SNOW_SIDE: 22, WOOL_RED: 23, WOOL_BLUE: 24,
    WOOL_YELLOW: 25, WOOL_WHITE: 26, GLOWSTONE: 27, OBSIDIAN: 28, CACTUS_SIDE: 29,
    CACTUS_TOP: 30, BOOKSHELF: 31
  };

  // id -> définition
  // tex: [haut, bas, côté]
  // solid: collision ; transparent: ne cache pas les faces voisines
  // hardness: temps de casse en secondes (survie) ; -1 = incassable
  // drop: id déposé quand cassé (survie), 0 = rien
  const BLOCKS = [
    { id: 0, name: 'Air', tex: null, solid: false, transparent: true, hardness: 0, drop: 0 },
    { id: 1, name: 'Herbe', tex: [T.GRASS_TOP, T.DIRT, T.GRASS_SIDE], solid: true, transparent: false, hardness: 0.6, drop: 2 },
    { id: 2, name: 'Terre', tex: [T.DIRT, T.DIRT, T.DIRT], solid: true, transparent: false, hardness: 0.5, drop: 2 },
    { id: 3, name: 'Pierre', tex: [T.STONE, T.STONE, T.STONE], solid: true, transparent: false, hardness: 1.5, drop: 9 },
    { id: 4, name: 'Bûche de chêne', tex: [T.LOG_TOP, T.LOG_TOP, T.LOG_SIDE], solid: true, transparent: false, hardness: 1.0, drop: 4 },
    { id: 5, name: 'Feuilles', tex: [T.LEAVES, T.LEAVES, T.LEAVES], solid: true, transparent: true, cutout: true, hardness: 0.2, drop: 0 },
    { id: 6, name: 'Sable', tex: [T.SAND, T.SAND, T.SAND], solid: true, transparent: false, hardness: 0.5, drop: 6, gravity: true },
    { id: 7, name: 'Eau', tex: [T.WATER, T.WATER, T.WATER], solid: false, transparent: true, liquid: true, hardness: -1, drop: 0 },
    { id: 8, name: 'Planches', tex: [T.PLANKS, T.PLANKS, T.PLANKS], solid: true, transparent: false, hardness: 1.0, drop: 8 },
    { id: 9, name: 'Pierre taillée', tex: [T.COBBLE, T.COBBLE, T.COBBLE], solid: true, transparent: false, hardness: 1.5, drop: 9 },
    { id: 10, name: 'Verre', tex: [T.GLASS, T.GLASS, T.GLASS], solid: true, transparent: true, cutout: true, hardness: 0.3, drop: 0 },
    { id: 11, name: 'Bedrock', tex: [T.BEDROCK, T.BEDROCK, T.BEDROCK], solid: true, transparent: false, hardness: -1, drop: 0 },
    { id: 12, name: 'Briques', tex: [T.BRICK, T.BRICK, T.BRICK], solid: true, transparent: false, hardness: 1.5, drop: 12 },
    { id: 13, name: 'Minerai de charbon', tex: [T.COAL, T.COAL, T.COAL], solid: true, transparent: false, hardness: 2.0, drop: 13 },
    { id: 14, name: 'Minerai de fer', tex: [T.IRON, T.IRON, T.IRON], solid: true, transparent: false, hardness: 2.5, drop: 14 },
    { id: 15, name: "Minerai d'or", tex: [T.GOLD, T.GOLD, T.GOLD], solid: true, transparent: false, hardness: 2.5, drop: 15 },
    { id: 16, name: 'Minerai de diamant', tex: [T.DIAMOND, T.DIAMOND, T.DIAMOND], solid: true, transparent: false, hardness: 3.0, drop: 16 },
    { id: 17, name: 'Neige', tex: [T.SNOW, T.DIRT, T.SNOW_SIDE], solid: true, transparent: false, hardness: 0.5, drop: 2 },
    { id: 18, name: 'Gravier', tex: [T.GRAVEL, T.GRAVEL, T.GRAVEL], solid: true, transparent: false, hardness: 0.6, drop: 18, gravity: true },
    { id: 19, name: 'Table de craft', tex: [T.CRAFT_TOP, T.PLANKS, T.CRAFT_SIDE], solid: true, transparent: false, hardness: 1.0, drop: 19 },
    { id: 20, name: 'Laine rouge', tex: [T.WOOL_RED, T.WOOL_RED, T.WOOL_RED], solid: true, transparent: false, hardness: 0.8, drop: 20 },
    { id: 21, name: 'Laine bleue', tex: [T.WOOL_BLUE, T.WOOL_BLUE, T.WOOL_BLUE], solid: true, transparent: false, hardness: 0.8, drop: 21 },
    { id: 22, name: 'Laine jaune', tex: [T.WOOL_YELLOW, T.WOOL_YELLOW, T.WOOL_YELLOW], solid: true, transparent: false, hardness: 0.8, drop: 22 },
    { id: 23, name: 'Laine blanche', tex: [T.WOOL_WHITE, T.WOOL_WHITE, T.WOOL_WHITE], solid: true, transparent: false, hardness: 0.8, drop: 23 },
    { id: 24, name: 'Pierre lumineuse', tex: [T.GLOWSTONE, T.GLOWSTONE, T.GLOWSTONE], solid: true, transparent: false, hardness: 0.3, drop: 24, light: true },
    { id: 25, name: 'Obsidienne', tex: [T.OBSIDIAN, T.OBSIDIAN, T.OBSIDIAN], solid: true, transparent: false, hardness: 6.0, drop: 25 },
    { id: 26, name: 'Cactus', tex: [T.CACTUS_TOP, T.CACTUS_TOP, T.CACTUS_SIDE], solid: true, transparent: true, cutout: true, hardness: 0.4, drop: 26 },
    { id: 27, name: 'Bibliothèque', tex: [T.PLANKS, T.PLANKS, T.BOOKSHELF], solid: true, transparent: false, hardness: 1.5, drop: 8 }
  ];

  const byId = new Array(256).fill(null);
  BLOCKS.forEach((b) => { byId[b.id] = b; });

  // Blocs proposés en mode créatif (dans l'ordre d'affichage)
  const CREATIVE_LIST = [1, 2, 3, 9, 4, 8, 5, 6, 18, 10, 12, 19, 27, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 7];

  // Recettes de craft simplifiées : { in: [[id, qty]...], out: [id, qty] }
  const RECIPES = [
    { name: 'Planches', in: [[4, 1]], out: [8, 4] },
    { name: 'Table de craft', in: [[8, 4]], out: [19, 1] },
    { name: 'Verre (fonte du sable)', in: [[6, 1]], out: [10, 1] },
    { name: 'Pierre (cuisson)', in: [[9, 1]], out: [3, 1] },
    { name: 'Briques', in: [[2, 2], [9, 2]], out: [12, 4] },
    { name: 'Bibliothèque', in: [[8, 6]], out: [27, 1] },
    { name: 'Laine blanche', in: [[5, 4]], out: [23, 1] },
    { name: 'Laine rouge', in: [[23, 1], [12, 1]], out: [20, 1] },
    { name: 'Laine bleue', in: [[23, 1], [7, 1]], out: [21, 1] },
    { name: 'Laine jaune', in: [[23, 1], [6, 1]], out: [22, 1] },
    { name: 'Pierre lumineuse', in: [[13, 2], [10, 1]], out: [24, 1] },
    { name: 'Obsidienne', in: [[3, 4], [7, 1]], out: [25, 1] }
  ];

  MC.TEX = T;
  MC.BLOCKS = byId;
  MC.BLOCK_LIST = BLOCKS;
  MC.CREATIVE_LIST = CREATIVE_LIST;
  MC.RECIPES = RECIPES;
  MC.ATLAS_COLS = 8;
  MC.ATLAS_ROWS = 4;
  MC.isSolid = (id) => { const b = byId[id]; return !!(b && b.solid); };
  MC.isTransparent = (id) => { const b = byId[id]; return !b || b.transparent; };
  MC.isLiquid = (id) => { const b = byId[id]; return !!(b && b.liquid); };
})(typeof window !== 'undefined' ? (window.MC = window.MC || {}) : (module.exports = {}));
