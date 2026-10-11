// Material catalogue. Pure data: the engine turns these into PBR materials with
// procedurally generated textures (no external assets required).

export type MaterialCategory =
  | 'wood'
  | 'fabric'
  | 'leather'
  | 'metal'
  | 'stone'
  | 'ceramic'
  | 'lacquer'
  | 'glass'
  | 'floor'
  | 'wall'
  | 'paint'
  | 'rug'
  | 'art'
  | 'plant'
  | 'soil'
  | 'shade'
  | 'paper'
  | 'mirror'
  | 'screen'
  | 'fixed';

export type TextureKind =
  | 'woodgrain'
  | 'planks'
  | 'herringbone'
  | 'marble'
  | 'travertine'
  | 'concrete'
  | 'terrazzo'
  | 'linen'
  | 'boucle'
  | 'velvet'
  | 'leather'
  | 'plaster'
  | 'brick'
  | 'slats'
  | 'zellige'
  | 'rug-berber'
  | 'rug-border'
  | 'rug-abstract'
  | 'rug-stripes'
  | 'art-arches'
  | 'art-sun'
  | 'art-lines'
  | 'art-blocks'
  | 'art-landscape'
  | 'leaf'
  | 'rattan'
  | 'bark';

export interface TextureSpec {
  kind: TextureKind;
  /** Size of one texture tile in meters (ignored for 'stretch' textures). */
  tile: number;
  /** Palette used by the generator, kind-specific. */
  colors: string[];
  seed?: number;
  /** Texture is mapped once over the object's UV range (art, rugs). */
  stretch?: boolean;
  /** Normal map strength. */
  bump?: number;
  /** Split the tile into an NxN grid of slabs with grout lines. */
  grid?: number;
}

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  color: string;
  roughness: number;
  metalness?: number;
  texture?: TextureSpec;
  sheen?: number;
  sheenColor?: string;
  clearcoat?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  envIntensity?: number;
  side?: 'double';
  vertexColors?: boolean;
}

const M: MaterialDef[] = [
  // ── Wood ────────────────────────────────────────────────────────────────
  { id: 'oak', name: 'Roble natural', category: 'wood', color: '#c49a6c', roughness: 0.55, texture: { kind: 'woodgrain', tile: 0.9, colors: ['#c9a171', '#a97c4f', '#dcb98c'], seed: 3, bump: 0.35 } },
  { id: 'oak-white', name: 'Roble blanqueado', category: 'wood', color: '#d8c6ad', roughness: 0.6, texture: { kind: 'woodgrain', tile: 0.9, colors: ['#ddcdb5', '#bba78b', '#ece0cd'], seed: 5, bump: 0.3 } },
  { id: 'walnut', name: 'Nogal', category: 'wood', color: '#5c3d28', roughness: 0.45, texture: { kind: 'woodgrain', tile: 0.9, colors: ['#664430', '#3e2617', '#7d5639'], seed: 7, bump: 0.35 } },
  { id: 'ash-black', name: 'Fresno negro', category: 'wood', color: '#262220', roughness: 0.5, texture: { kind: 'woodgrain', tile: 0.8, colors: ['#2b2724', '#191614', '#3b3531'], seed: 11, bump: 0.45 } },
  { id: 'teak', name: 'Teca', category: 'wood', color: '#9a6a3f', roughness: 0.5, texture: { kind: 'woodgrain', tile: 0.9, colors: ['#a06e42', '#7a4d2a', '#b9875a'], seed: 13, bump: 0.35 } },
  { id: 'cherry', name: 'Cerezo', category: 'wood', color: '#8e4b32', roughness: 0.42, texture: { kind: 'woodgrain', tile: 0.9, colors: ['#94503a', '#6e3324', '#ad6a4c'], seed: 17, bump: 0.3 } },

  // ── Upholstery ─────────────────────────────────────────────────────────
  { id: 'linen-oat', name: 'Lino avena', category: 'fabric', color: '#d9cdb8', roughness: 0.92, sheen: 0.6, sheenColor: '#fff6e8', texture: { kind: 'linen', tile: 0.12, colors: ['#d9cdb8'], bump: 0.5 } },
  { id: 'linen-stone', name: 'Lino piedra', category: 'fabric', color: '#a9a397', roughness: 0.92, sheen: 0.6, sheenColor: '#efe9df', texture: { kind: 'linen', tile: 0.12, colors: ['#a9a397'], bump: 0.5 } },
  { id: 'linen-sage', name: 'Lino salvia', category: 'fabric', color: '#8f9a80', roughness: 0.92, sheen: 0.55, sheenColor: '#e5ecd9', texture: { kind: 'linen', tile: 0.12, colors: ['#8f9a80'], bump: 0.5 } },
  { id: 'linen-charcoal', name: 'Lino carbón', category: 'fabric', color: '#4a4846', roughness: 0.9, sheen: 0.5, sheenColor: '#b4b0aa', texture: { kind: 'linen', tile: 0.12, colors: ['#4a4846'], bump: 0.5 } },
  { id: 'boucle-cream', name: 'Bouclé crema', category: 'fabric', color: '#ece5d8', roughness: 0.96, sheen: 0.7, sheenColor: '#ffffff', texture: { kind: 'boucle', tile: 0.16, colors: ['#ece5d8'], bump: 1.1 } },
  { id: 'boucle-sand', name: 'Bouclé arena', category: 'fabric', color: '#cbb89c', roughness: 0.96, sheen: 0.7, sheenColor: '#fff3e0', texture: { kind: 'boucle', tile: 0.16, colors: ['#cbb89c'], bump: 1.1 } },
  { id: 'velvet-terracotta', name: 'Terciopelo terracota', category: 'fabric', color: '#a4553a', roughness: 0.75, sheen: 1, sheenColor: '#f0a27f', texture: { kind: 'velvet', tile: 0.4, colors: ['#a4553a'], bump: 0.25 } },
  { id: 'velvet-forest', name: 'Terciopelo bosque', category: 'fabric', color: '#2f4a3a', roughness: 0.75, sheen: 1, sheenColor: '#7fae8e', texture: { kind: 'velvet', tile: 0.4, colors: ['#2f4a3a'], bump: 0.25 } },
  { id: 'velvet-navy', name: 'Terciopelo marino', category: 'fabric', color: '#283550', roughness: 0.75, sheen: 1, sheenColor: '#7f92c0', texture: { kind: 'velvet', tile: 0.4, colors: ['#283550'], bump: 0.25 } },
  { id: 'velvet-mustard', name: 'Terciopelo mostaza', category: 'fabric', color: '#b8892c', roughness: 0.75, sheen: 1, sheenColor: '#ffd98a', texture: { kind: 'velvet', tile: 0.4, colors: ['#b8892c'], bump: 0.25 } },
  { id: 'leather-cognac', name: 'Piel coñac', category: 'leather', color: '#8a4e2a', roughness: 0.55, clearcoat: 0.15, texture: { kind: 'leather', tile: 0.3, colors: ['#8a4e2a', '#6e3a1d'], bump: 0.4 } },
  { id: 'leather-black', name: 'Piel negra', category: 'leather', color: '#1d1b1a', roughness: 0.5, clearcoat: 0.2, texture: { kind: 'leather', tile: 0.3, colors: ['#1f1d1c', '#131211'], bump: 0.4 } },
  { id: 'leather-tan', name: 'Piel natural', category: 'leather', color: '#b98a5c', roughness: 0.6, clearcoat: 0.1, texture: { kind: 'leather', tile: 0.3, colors: ['#bb8c5e', '#9c6f45'], bump: 0.4 } },

  // ── Metals ─────────────────────────────────────────────────────────────
  { id: 'brass', name: 'Latón cepillado', category: 'metal', color: '#c9a45c', roughness: 0.32, metalness: 1 },
  { id: 'steel-black', name: 'Acero negro', category: 'metal', color: '#232323', roughness: 0.45, metalness: 0.85 },
  { id: 'chrome', name: 'Cromo', category: 'metal', color: '#e6e6e6', roughness: 0.08, metalness: 1 },
  { id: 'bronze', name: 'Bronce oscuro', category: 'metal', color: '#5d4a38', roughness: 0.38, metalness: 1 },
  { id: 'aluminium', name: 'Aluminio', category: 'metal', color: '#bfc2c4', roughness: 0.35, metalness: 1 },

  // ── Stone ──────────────────────────────────────────────────────────────
  { id: 'marble-carrara', name: 'Mármol Carrara', category: 'stone', color: '#ebe9e5', roughness: 0.18, texture: { kind: 'marble', tile: 1.2, colors: ['#efeeea', '#9c9b98', '#c9c7c2'], seed: 21, bump: 0.05 } },
  { id: 'marble-nero', name: 'Nero Marquina', category: 'stone', color: '#1a1a1a', roughness: 0.15, texture: { kind: 'marble', tile: 1.2, colors: ['#1b1b1c', '#e8e6e1', '#3a3a3b'], seed: 23, bump: 0.05 } },
  { id: 'marble-verde', name: 'Verde Alpi', category: 'stone', color: '#2d4537', roughness: 0.16, texture: { kind: 'marble', tile: 1.0, colors: ['#25392e', '#cfd8cf', '#46634f'], seed: 29, bump: 0.05 } },
  { id: 'travertine', name: 'Travertino', category: 'stone', color: '#d7c3a5', roughness: 0.6, texture: { kind: 'travertine', tile: 1.6, colors: ['#d9c6a8', '#c7b08d', '#e8dac3'], seed: 31, bump: 0.3 } },
  { id: 'stone-grey', name: 'Piedra gris', category: 'stone', color: '#8a8780', roughness: 0.75, texture: { kind: 'concrete', tile: 1.2, colors: ['#8c8982', '#6f6c66', '#a29f98'], seed: 33, bump: 0.4 } },

  // ── Ceramic & lacquer ─────────────────────────────────────────────────
  { id: 'ceramic-white', name: 'Cerámica blanca', category: 'ceramic', color: '#f1eee8', roughness: 0.28, clearcoat: 0.4 },
  { id: 'ceramic-sand', name: 'Gres arena', category: 'ceramic', color: '#c9ad8a', roughness: 0.75, texture: { kind: 'concrete', tile: 0.3, colors: ['#ccb08d', '#b3956f', '#dcc3a3'], seed: 41, bump: 0.25 } },
  { id: 'ceramic-terracotta', name: 'Terracota', category: 'ceramic', color: '#b0633f', roughness: 0.85, texture: { kind: 'concrete', tile: 0.3, colors: ['#b4673f', '#965130', '#c4794f'], seed: 43, bump: 0.25 } },
  { id: 'ceramic-black', name: 'Cerámica negra mate', category: 'ceramic', color: '#252423', roughness: 0.7 },
  { id: 'ceramic-sage', name: 'Esmalte salvia', category: 'ceramic', color: '#93a48e', roughness: 0.3, clearcoat: 0.5 },
  { id: 'ceramic-blue', name: 'Esmalte cobalto', category: 'ceramic', color: '#2e4f86', roughness: 0.22, clearcoat: 0.6 },
  { id: 'lacquer-white', name: 'Lacado blanco', category: 'lacquer', color: '#f0ede6', roughness: 0.35, clearcoat: 0.6 },
  { id: 'lacquer-black', name: 'Lacado negro', category: 'lacquer', color: '#1c1c1c', roughness: 0.3, clearcoat: 0.7 },
  { id: 'lacquer-olive', name: 'Lacado oliva', category: 'lacquer', color: '#6b6a45', roughness: 0.38, clearcoat: 0.5 },
  { id: 'lacquer-rust', name: 'Lacado óxido', category: 'lacquer', color: '#9b4a2c', roughness: 0.38, clearcoat: 0.5 },
  { id: 'lacquer-powder', name: 'Azul empolvado', category: 'lacquer', color: '#9fb2c0', roughness: 0.4, clearcoat: 0.4 },

  // ── Glass & mirror ────────────────────────────────────────────────────
  { id: 'glass-clear', name: 'Vidrio', category: 'glass', color: '#dfe9ec', roughness: 0.04, opacity: 0.18, envIntensity: 1.6 },
  { id: 'glass-smoke', name: 'Vidrio ahumado', category: 'glass', color: '#5a5550', roughness: 0.05, opacity: 0.55, envIntensity: 1.4 },
  { id: 'glass-amber', name: 'Vidrio ámbar', category: 'glass', color: '#c98a3a', roughness: 0.05, opacity: 0.6, envIntensity: 1.4 },
  { id: 'mirror', name: 'Espejo', category: 'mirror', color: '#ffffff', roughness: 0.02, metalness: 1 },
  { id: 'screen', name: 'Pantalla', category: 'screen', color: '#0b0c0d', roughness: 0.12, clearcoat: 1 },

  // ── Shades ────────────────────────────────────────────────────────────
  { id: 'shade-linen', name: 'Pantalla de lino', category: 'shade', color: '#f3eadb', roughness: 0.9, emissive: '#ffd9a3', emissiveIntensity: 0, side: 'double', texture: { kind: 'linen', tile: 0.1, colors: ['#f3eadb'], bump: 0.3 } },
  { id: 'shade-opal', name: 'Vidrio opal', category: 'shade', color: '#f7f4ee', roughness: 0.25, emissive: '#ffe2b8', emissiveIntensity: 0 },
  { id: 'shade-paper', name: 'Papel washi', category: 'shade', color: '#efe5d3', roughness: 0.95, emissive: '#ffd49a', emissiveIntensity: 0, side: 'double', texture: { kind: 'rattan', tile: 0.12, colors: ['#efe5d3', '#e0d2b9'], bump: 0.15 } },

  // ── Plants ────────────────────────────────────────────────────────────
  { id: 'leaf-green', name: 'Hoja', category: 'plant', color: '#3f6b35', roughness: 0.55, side: 'double', texture: { kind: 'leaf', tile: 1, stretch: true, colors: ['#3f6b35', '#2c5127', '#6f9a54'], bump: 0.4 } },
  { id: 'leaf-dark', name: 'Hoja oscura', category: 'plant', color: '#2b4a2c', roughness: 0.5, side: 'double', texture: { kind: 'leaf', tile: 1, stretch: true, colors: ['#2b4a2c', '#1d351f', '#56794a'], bump: 0.4 } },
  { id: 'leaf-olive', name: 'Hoja de olivo', category: 'plant', color: '#7d8a62', roughness: 0.6, side: 'double', texture: { kind: 'leaf', tile: 1, stretch: true, colors: ['#7d8a62', '#5f6b48', '#a3ad85'], bump: 0.3 } },
  { id: 'bark', name: 'Tronco', category: 'plant', color: '#5a4636', roughness: 0.9, texture: { kind: 'bark', tile: 0.3, colors: ['#5a4636', '#3c2e23'], bump: 0.6 } },
  { id: 'soil', name: 'Tierra', category: 'soil', color: '#3a2c22', roughness: 1, texture: { kind: 'concrete', tile: 0.2, colors: ['#3a2c22', '#2a1f18', '#4d3b2d'], seed: 51, bump: 0.8 } },
  { id: 'rattan', name: 'Ratán', category: 'wood', color: '#c8a26a', roughness: 0.7, texture: { kind: 'rattan', tile: 0.08, colors: ['#cfa970', '#a8834d'], bump: 0.6 } },
  { id: 'paper-books', name: 'Libros', category: 'paper', color: '#e9e2d4', roughness: 0.85 },

  // ── Floors ────────────────────────────────────────────────────────────
  { id: 'floor-oak-planks', name: 'Tablón de roble', category: 'floor', color: '#c3986a', roughness: 0.5, texture: { kind: 'planks', tile: 2.4, colors: ['#c79d6e', '#a67a4c', '#ddb98d'], seed: 61, bump: 0.5 } },
  { id: 'floor-oak-light', name: 'Roble nórdico', category: 'floor', color: '#d9c09d', roughness: 0.55, texture: { kind: 'planks', tile: 2.4, colors: ['#dcc4a2', '#bfa27b', '#ead8bd'], seed: 63, bump: 0.5 } },
  { id: 'floor-smoked-oak', name: 'Roble ahumado', category: 'floor', color: '#6e4f37', roughness: 0.45, texture: { kind: 'planks', tile: 2.4, colors: ['#71513a', '#4f3524', '#8c6a4c'], seed: 65, bump: 0.5 } },
  { id: 'floor-herringbone', name: 'Espiga de roble', category: 'floor', color: '#bf935f', roughness: 0.45, texture: { kind: 'herringbone', tile: 1.0, colors: ['#c3975f', '#a2773f', '#d6ae79'], seed: 67, bump: 0.5 } },
  { id: 'floor-herringbone-walnut', name: 'Espiga de nogal', category: 'floor', color: '#5f412c', roughness: 0.4, texture: { kind: 'herringbone', tile: 1.0, colors: ['#664632', '#47301f', '#7d5a40'], seed: 69, bump: 0.5 } },
  { id: 'floor-concrete', name: 'Microcemento', category: 'floor', color: '#a7a39c', roughness: 0.6, texture: { kind: 'concrete', tile: 3.0, colors: ['#aaa69f', '#8f8b84', '#bdb9b2'], seed: 71, bump: 0.2 } },
  { id: 'floor-terrazzo', name: 'Terrazo', category: 'floor', color: '#e3ddd3', roughness: 0.3, texture: { kind: 'terrazzo', tile: 1.2, colors: ['#e5dfd5', '#b55e3c', '#3e3b37', '#9aa392', '#d7c3a1', '#fdfbf7'], seed: 73, bump: 0.1 } },
  { id: 'floor-travertine', name: 'Losa de travertino', category: 'floor', color: '#d4c0a0', roughness: 0.55, texture: { kind: 'travertine', tile: 1.8, colors: ['#d7c4a4', '#bba380', '#e6d7bf'], seed: 75, bump: 0.35, grid: 2 } },
  { id: 'floor-marble', name: 'Mármol en losas', category: 'floor', color: '#e8e5e0', roughness: 0.15, texture: { kind: 'marble', tile: 2.4, colors: ['#ecebe7', '#a3a29e', '#cfcdc8'], seed: 77, bump: 0.05, grid: 2 } },

  // ── Wall finishes ─────────────────────────────────────────────────────
  { id: 'paint-warm-white', name: 'Blanco cálido', category: 'paint', color: '#efe9df', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#efe9df'], bump: 0.08, seed: 81 } },
  { id: 'paint-bone', name: 'Hueso', category: 'paint', color: '#e2d8c6', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#e2d8c6'], bump: 0.08, seed: 82 } },
  { id: 'paint-greige', name: 'Greige', category: 'paint', color: '#c9bfb0', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#c9bfb0'], bump: 0.08, seed: 83 } },
  { id: 'paint-sage', name: 'Salvia', category: 'paint', color: '#a7b19a', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#a7b19a'], bump: 0.08, seed: 84 } },
  { id: 'paint-clay', name: 'Arcilla', category: 'paint', color: '#c4876a', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#c4876a'], bump: 0.08, seed: 85 } },
  { id: 'paint-blush', name: 'Rosa empolvado', category: 'paint', color: '#e2c2b5', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#e2c2b5'], bump: 0.08, seed: 86 } },
  { id: 'paint-forest', name: 'Verde bosque', category: 'paint', color: '#3f5245', roughness: 0.9, texture: { kind: 'plaster', tile: 3, colors: ['#3f5245'], bump: 0.08, seed: 87 } },
  { id: 'paint-ink', name: 'Azul tinta', category: 'paint', color: '#2f3a4a', roughness: 0.9, texture: { kind: 'plaster', tile: 3, colors: ['#2f3a4a'], bump: 0.08, seed: 88 } },
  { id: 'paint-charcoal', name: 'Carbón', category: 'paint', color: '#3b3936', roughness: 0.9, texture: { kind: 'plaster', tile: 3, colors: ['#3b3936'], bump: 0.08, seed: 89 } },
  { id: 'paint-ochre', name: 'Ocre', category: 'paint', color: '#c99a4f', roughness: 0.92, texture: { kind: 'plaster', tile: 3, colors: ['#c99a4f'], bump: 0.08, seed: 90 } },
  { id: 'paint-white', name: 'Blanco puro', category: 'paint', color: '#f6f5f2', roughness: 0.9 },
  { id: 'wall-limewash', name: 'Cal arena', category: 'wall', color: '#d9cbb4', roughness: 0.95, texture: { kind: 'plaster', tile: 2.2, colors: ['#dbcdb6', '#c4b293', '#ebdfcc'], bump: 0.35, seed: 91 } },
  { id: 'wall-limewash-grey', name: 'Cal piedra', category: 'wall', color: '#b9b5ad', roughness: 0.95, texture: { kind: 'plaster', tile: 2.2, colors: ['#bcb8b0', '#a19c93', '#cfccc5'], bump: 0.35, seed: 92 } },
  { id: 'wall-limewash-terra', name: 'Cal terracota', category: 'wall', color: '#b9775a', roughness: 0.95, texture: { kind: 'plaster', tile: 2.2, colors: ['#bb795b', '#a0614a', '#cd9073'], bump: 0.35, seed: 93 } },
  { id: 'wall-oak-slats', name: 'Listones de roble', category: 'wall', color: '#b98d5e', roughness: 0.6, texture: { kind: 'slats', tile: 0.8, colors: ['#bd9161', '#9d7244', '#d1aa7c', '#2a2420'], seed: 94, bump: 1 } },
  { id: 'wall-walnut-slats', name: 'Listones de nogal', category: 'wall', color: '#5d3f2a', roughness: 0.55, texture: { kind: 'slats', tile: 0.8, colors: ['#624430', '#432c1c', '#7a573c', '#141110'], seed: 95, bump: 1 } },
  { id: 'wall-brick', name: 'Ladrillo encalado', category: 'wall', color: '#e3ddd4', roughness: 0.9, texture: { kind: 'brick', tile: 1.2, colors: ['#e6e0d7', '#c9b9a7', '#b06b4e', '#d8d2c8'], seed: 96, bump: 1 } },
  { id: 'wall-zellige', name: 'Zellige verde', category: 'wall', color: '#4f7a68', roughness: 0.2, texture: { kind: 'zellige', tile: 0.8, colors: ['#4f7a68', '#3c6454', '#6a9583', '#e9e4da'], seed: 97, bump: 0.6 } },
  { id: 'wall-zellige-white', name: 'Zellige blanco', category: 'wall', color: '#ece8df', roughness: 0.2, texture: { kind: 'zellige', tile: 0.8, colors: ['#eeeae2', '#dcd6ca', '#f8f6f1', '#cfc8bb'], seed: 98, bump: 0.6 } },
  { id: 'wall-microcement', name: 'Microcemento', category: 'wall', color: '#b3aea6', roughness: 0.75, texture: { kind: 'concrete', tile: 2.5, colors: ['#b5b0a8', '#9c978f', '#c7c3bc'], seed: 99, bump: 0.15 } },

  // ── Rugs ──────────────────────────────────────────────────────────────
  { id: 'rug-berber', name: 'Bereber', category: 'rug', color: '#eae2d3', roughness: 1, sheen: 0.6, sheenColor: '#ffffff', texture: { kind: 'rug-berber', tile: 1, stretch: true, colors: ['#ece4d5', '#2e2a26', '#d8cdb9'], seed: 101, bump: 0.9 } },
  { id: 'rug-border', name: 'Lana con ribete', category: 'rug', color: '#cfc5b3', roughness: 1, sheen: 0.6, sheenColor: '#ffffff', texture: { kind: 'rug-border', tile: 1, stretch: true, colors: ['#d2c8b6', '#7b6a55', '#bfb39e'], seed: 103, bump: 0.9 } },
  { id: 'rug-abstract', name: 'Abstracto terracota', category: 'rug', color: '#d7c5ad', roughness: 1, sheen: 0.6, sheenColor: '#ffffff', texture: { kind: 'rug-abstract', tile: 1, stretch: true, colors: ['#dccbb3', '#b0603f', '#4a5a49', '#e9ddca'], seed: 105, bump: 0.9 } },
  { id: 'rug-stripes', name: 'Rayas kilim', category: 'rug', color: '#b9a385', roughness: 1, sheen: 0.5, sheenColor: '#ffffff', texture: { kind: 'rug-stripes', tile: 1, stretch: true, colors: ['#c4ae8e', '#5c4632', '#e5d8c2', '#9b5338'], seed: 107, bump: 0.9 } },
  { id: 'rug-jute', name: 'Yute', category: 'rug', color: '#b99d70', roughness: 1, texture: { kind: 'rattan', tile: 0.05, colors: ['#bea375', '#9c8156'], bump: 1 } },
  { id: 'rug-charcoal', name: 'Lana carbón', category: 'rug', color: '#4a4744', roughness: 1, sheen: 0.6, sheenColor: '#a09a93', texture: { kind: 'boucle', tile: 0.2, colors: ['#4a4744'], bump: 0.9 } },

  // ── Artwork ───────────────────────────────────────────────────────────
  { id: 'art-arches', name: 'Arcos', category: 'art', color: '#e8dccb', roughness: 0.9, texture: { kind: 'art-arches', tile: 1, stretch: true, colors: ['#ece2d2', '#c46f4a', '#2f3b36', '#d9a76a', '#9aa58f'], seed: 111 } },
  { id: 'art-sun', name: 'Sol poniente', category: 'art', color: '#e9c9a3', roughness: 0.9, texture: { kind: 'art-sun', tile: 1, stretch: true, colors: ['#efe3d0', '#d8693e', '#e8b25e', '#5b4636'], seed: 113 } },
  { id: 'art-lines', name: 'Línea continua', category: 'art', color: '#f1ece3', roughness: 0.9, texture: { kind: 'art-lines', tile: 1, stretch: true, colors: ['#f2ede4', '#1f1d1b', '#c46f4a'], seed: 115 } },
  { id: 'art-blocks', name: 'Campos de color', category: 'art', color: '#c7a782', roughness: 0.9, texture: { kind: 'art-blocks', tile: 1, stretch: true, colors: ['#e6dccb', '#2d4a3e', '#c47b4e', '#e3b65e', '#8a9bb0'], seed: 117 } },
  { id: 'art-landscape', name: 'Paisaje brumoso', category: 'art', color: '#9fa9a6', roughness: 0.9, texture: { kind: 'art-landscape', tile: 1, stretch: true, colors: ['#e7e1d6', '#9aa7a2', '#5f6f6b', '#2f3a38', '#d7b48c'], seed: 119 } },

  // ── Internal (not user selectable) ────────────────────────────────────
  { id: 'fx-orange', name: 'Naranja', category: 'fixed', color: '#e0782c', roughness: 0.45 },
  { id: 'fx-lemon', name: 'Limón', category: 'fixed', color: '#e6c94a', roughness: 0.5 },
  { id: 'fx-wax', name: 'Cera', category: 'fixed', color: '#f3ede2', roughness: 0.55 },
  { id: 'fx-cord', name: 'Cable', category: 'fixed', color: '#1c1b1a', roughness: 0.6 },
  { id: 'fx-white', name: 'Blanco', category: 'fixed', color: '#f4f1ea', roughness: 0.6 },
  { id: 'fx-bulb', name: 'Bombilla', category: 'fixed', color: '#fff6e4', roughness: 0.2, emissive: '#ffd59a', emissiveIntensity: 0 },
  { id: 'fx-branch', name: 'Rama', category: 'fixed', color: '#6b5a48', roughness: 0.85 },
  { id: 'fx-books', name: 'Libros', category: 'fixed', color: '#ffffff', roughness: 0.8, vertexColors: true },
  { id: 'fx-pages', name: 'Páginas', category: 'fixed', color: '#efe7d6', roughness: 0.9 },
  { id: 'fx-black', name: 'Negro', category: 'fixed', color: '#151515', roughness: 0.4 },
  { id: 'fx-pillow', name: 'Cojín', category: 'fixed', color: '#c99a4f', roughness: 0.8, sheen: 1, sheenColor: '#ffd98a', texture: { kind: 'velvet', tile: 0.4, colors: ['#b8892c'], bump: 0.25 } },
  { id: 'fx-rubber', name: 'Goma', category: 'fixed', color: '#222', roughness: 0.9 },
  { id: 'ext-lawn', name: 'Césped', category: 'fixed', color: '#6f8a4e', roughness: 0.95, texture: { kind: 'concrete', tile: 6, colors: ['#71894c', '#5b7440', '#86a05e'], seed: 131, bump: 0.6 } },
  { id: 'ext-deck', name: 'Tarima exterior', category: 'fixed', color: '#8a6a4c', roughness: 0.7, texture: { kind: 'slats', tile: 1.2, colors: ['#94724f', '#77593d', '#a7845f', '#3a2c20'], seed: 133, bump: 0.8 } },
  { id: 'ext-gravel', name: 'Losa exterior', category: 'fixed', color: '#c4bcb0', roughness: 0.9, texture: { kind: 'concrete', tile: 2.5, colors: ['#c6beb2', '#b1a99c', '#d3ccc1'], seed: 135, bump: 0.5, grid: 4 } },
  { id: 'ext-bark', name: 'Corteza', category: 'fixed', color: '#5a4636', roughness: 0.9 },
  { id: 'ext-plinth', name: 'Zócalo', category: 'fixed', color: '#e6e1d9', roughness: 0.9 },
  { id: 'ext-foliage', name: 'Follaje', category: 'fixed', color: '#4f6b3a', roughness: 0.85, texture: { kind: 'concrete', tile: 1.5, colors: ['#50703a', '#3c5a2c', '#6d8c4c'], seed: 137, bump: 1 } },
];

export const MATERIALS: Record<string, MaterialDef> = Object.fromEntries(M.map((m) => [m.id, m]));

export function materialsIn(categories: MaterialCategory[]): MaterialDef[] {
  return M.filter((m) => categories.includes(m.category));
}

export function getMaterial(id: string): MaterialDef {
  return MATERIALS[id] ?? MATERIALS['paint-white'];
}

/** Finish options for the architectural surfaces. */
export const FINISH_CATEGORIES = {
  floor: ['floor'] as MaterialCategory[],
  wall: ['paint', 'wall'] as MaterialCategory[],
  ceiling: ['paint'] as MaterialCategory[],
  trim: ['paint', 'wood', 'metal'] as MaterialCategory[],
  frames: ['metal', 'wood', 'lacquer'] as MaterialCategory[],
};

export const CATEGORY_LABELS: Partial<Record<MaterialCategory, string>> = {
  wood: 'Madera',
  fabric: 'Tejido',
  leather: 'Piel',
  metal: 'Metal',
  stone: 'Piedra',
  ceramic: 'Cerámica',
  lacquer: 'Lacado',
  glass: 'Vidrio',
  floor: 'Suelos',
  wall: 'Revestimientos',
  paint: 'Pintura',
  rug: 'Alfombra',
  art: 'Obra',
  plant: 'Follaje',
  shade: 'Pantalla',
};
