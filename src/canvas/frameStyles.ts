/**
 * Datos visuales de marcos, colores y títulos para el canvas del perfil.
 */

export interface FrameStyle {
  borderColor:  string;
  glowColor:    string;
  glowBlur:     number;
  borderWidth:  number;
  style:        'solid' | 'double' | 'glow' | 'gradient' | 'ornate' | 'fire' | 'ice' | 'galaxy' | 'void' | 'legendary';
  extraColor?:  string;   // segundo color para gradientes/efectos
}

const FRAMES: Record<string, FrameStyle> = {
  frame_basic:     { borderColor: '#95a5a6', glowColor: '#95a5a6', glowBlur: 0,  borderWidth: 4, style: 'solid'     },
  frame_gold:      { borderColor: '#f1c40f', glowColor: '#ffd700', glowBlur: 12, borderWidth: 6, style: 'double',    extraColor: '#b8860b' },
  frame_neon_blue: { borderColor: '#00d2ff', glowColor: '#00d2ff', glowBlur: 22, borderWidth: 5, style: 'glow'      },
  frame_neon_pink: { borderColor: '#ff6b9d', glowColor: '#ff6b9d', glowBlur: 22, borderWidth: 5, style: 'glow'      },
  frame_fire:      { borderColor: '#ff4500', glowColor: '#ff6b35', glowBlur: 28, borderWidth: 7, style: 'fire',      extraColor: '#ffd700' },
  frame_ice:       { borderColor: '#a8edff', glowColor: '#00d2ff', glowBlur: 20, borderWidth: 6, style: 'ice',       extraColor: '#ffffff' },
  frame_galaxy:    { borderColor: '#9b59b6', glowColor: '#c39bd3', glowBlur: 25, borderWidth: 7, style: 'galaxy',    extraColor: '#3498db' },
  frame_dragon:    { borderColor: '#c0392b', glowColor: '#e74c3c', glowBlur: 22, borderWidth: 8, style: 'ornate',    extraColor: '#ffd700' },
  frame_celestial: { borderColor: '#ffd700', glowColor: '#fffacd', glowBlur: 28, borderWidth: 7, style: 'glow',      extraColor: '#ffffff' },
  frame_void:      { borderColor: '#8e44ad', glowColor: '#4a0080', glowBlur: 32, borderWidth: 8, style: 'void',      extraColor: '#1a0030' },
  frame_legendary: { borderColor: '#ffd700', glowColor: '#ffd700', glowBlur: 40, borderWidth: 9, style: 'legendary', extraColor: '#ff8c00' },
};

const COLORS: Record<string, string> = {
  color_red:    '#e74c3c',
  color_blue:   '#3498db',
  color_green:  '#2ecc71',
  color_purple: '#9b59b6',
  color_orange: '#e67e22',
  color_pink:   '#ff6b9d',
  color_cyan:   '#00d2ff',
  color_gold:   '#f1c40f',
  color_black:  '#2c2c2c',
  color_white:  '#ecf0f1',
};

const TITLES: Record<string, { label: string; color: string }> = {
  title_rookie:    { label: 'El Novato',          color: '#95a5a6' },
  title_gambler:   { label: 'El Apostador',        color: '#e67e22' },
  title_rich:      { label: 'El Adinerado',        color: '#f1c40f' },
  title_tamer:     { label: 'Domador de Bestias',  color: '#2ecc71' },
  title_shadow:    { label: 'La Sombra',           color: '#bdc3c7' },
  title_legend:    { label: 'La Leyenda',          color: '#f1c40f' },
  title_dragon:    { label: 'Jinete de Dragones',  color: '#e74c3c' },
  title_moonchild: { label: 'Hijo de la Luna',     color: '#9b59b6' },
  title_god:       { label: 'Dios del Servidor',   color: '#ffd700' },
  title_phantom:   { label: 'El Fantasma',         color: '#bdc3c7' },
  title_berserker: { label: 'El Berserker',        color: '#c0392b' },
  title_oracle:    { label: 'El Oráculo',          color: '#8e44ad' },
};

// Qué tipos de ítems son equipables y en qué slot
export const EQUIPPABLE_TYPES: Record<string, 'frame' | 'title' | 'color'> = {
  frame:    'frame',
  title:    'title',
  color:    'color',
  cosmetic: 'frame',
};

export function getFrameStyle(slug: string): FrameStyle | null {
  return FRAMES[slug] ?? null;
}

export function getColorHex(slug: string): string | null {
  return COLORS[slug] ?? null;
}

export function getTitleData(slug: string): { label: string; color: string } | null {
  return TITLES[slug] ?? null;
}
