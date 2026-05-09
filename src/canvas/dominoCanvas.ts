/**
 * Canvas para el tablero de dominó.
 * Dibuja fichas reales con puntos, el tablero en serpentina y la mano del jugador.
 */
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import { BoardTile, DominoTile, DominoPlayer, DominoGameData } from '../sistemas/domino/gameLogic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Posiciones de los puntos en una cuadrícula 3×3 (índices 0-8)
const DOT_POS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Colores de acento por valor (para hacer las fichas más visuales)
const VALUE_COLORS: Record<number, string> = {
  0: '#95a5a6', 1: '#3498db', 2: '#2ecc71', 3: '#e74c3c',
  4: '#f39c12', 5: '#9b59b6', 6: '#e67e22',
};

/**
 * Dibuja una mitad de ficha (cuadrado con puntos).
 * @param value  Número de puntos (0-6)
 * @param isLeft Si es la mitad izquierda (para dobles, ambas son iguales)
 */
function drawHalf(
  ctx: SKRSContext2D,
  x: number, y: number,
  size: number,
  value: number,
  highlight = false,
): void {
  const r    = size * 0.1;
  const dotR = size * 0.1;
  const pad  = size * 0.18;
  const cell = (size - pad * 2) / 3;

  // Fondo de la mitad
  const bg = ctx.createLinearGradient(x, y, x + size, y + size);
  if (highlight) {
    bg.addColorStop(0, '#fffde7');
    bg.addColorStop(1, '#fff9c4');
  } else {
    bg.addColorStop(0, '#fafafa');
    bg.addColorStop(1, '#eeeeee');
  }
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // Puntos
  const dots  = DOT_POS[value] ?? [];
  const color = VALUE_COLORS[value] ?? '#333';

  for (const pos of dots) {
    const col = pos % 3;
    const row = Math.floor(pos / 3);
    const dx  = x + pad + col * cell + cell / 2;
    const dy  = y + pad + row * cell + cell / 2;

    // Sombra del punto
    ctx.save();
    ctx.shadowColor   = rgba(color, 0.4);
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const dg = ctx.createRadialGradient(dx - dotR * 0.3, dy - dotR * 0.3, dotR * 0.1, dx, dy, dotR);
    dg.addColorStop(0, color);
    dg.addColorStop(1, rgba(color, 0.7));
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Dibuja una ficha completa (horizontal o vertical).
 * @param horizontal  true = ficha horizontal [left|right], false = vertical
 */
function drawTile(
  ctx: SKRSContext2D,
  x: number, y: number,
  halfSize: number,
  left: number, right: number,
  horizontal: boolean,
  isNew = false,
  isEnd = false,
): void {
  const gap    = 2;   // separación entre mitades
  const border = 3;   // borde exterior

  const tileW = horizontal ? halfSize * 2 + gap + border * 2 : halfSize + border * 2;
  const tileH = horizontal ? halfSize + border * 2 : halfSize * 2 + gap + border * 2;

  // Sombra de la ficha
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur    = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Fondo de la ficha (marfil oscuro)
  const r = 5;
  ctx.fillStyle = isNew ? '#fff9c4' : '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + tileW - r, y);
  ctx.quadraticCurveTo(x + tileW, y, x + tileW, y + r);
  ctx.lineTo(x + tileW, y + tileH - r);
  ctx.quadraticCurveTo(x + tileW, y + tileH, x + tileW - r, y + tileH);
  ctx.lineTo(x + r, y + tileH);
  ctx.quadraticCurveTo(x, y + tileH, x, y + tileH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Borde de la ficha
  ctx.save();
  if (isEnd) {
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2.5;
  } else if (isNew) {
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth   = 2;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + tileW - r, y);
  ctx.quadraticCurveTo(x + tileW, y, x + tileW, y + r);
  ctx.lineTo(x + tileW, y + tileH - r);
  ctx.quadraticCurveTo(x + tileW, y + tileH, x + tileW - r, y + tileH);
  ctx.lineTo(x + r, y + tileH);
  ctx.quadraticCurveTo(x, y + tileH, x, y + tileH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Mitades
  if (horizontal) {
    drawHalf(ctx, x + border, y + border, halfSize, left,  isNew);
    // Línea divisoria
    ctx.fillStyle = isNew ? '#e0c000' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + border + halfSize, y + border + halfSize * 0.15, gap, halfSize * 0.7);
    drawHalf(ctx, x + border + halfSize + gap, y + border, halfSize, right, isNew);
  } else {
    drawHalf(ctx, x + border, y + border, halfSize, left,  isNew);
    ctx.fillStyle = isNew ? '#e0c000' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + border + halfSize * 0.15, y + border + halfSize, halfSize * 0.7, gap);
    drawHalf(ctx, x + border, y + border + halfSize + gap, halfSize, right, isNew);
  }
}

// ─── Canvas principal ─────────────────────────────────────────────────────────

export interface DominoBoardOptions {
  game:        DominoGameData;
  board:       BoardTile[];
  players:     DominoPlayer[];
  viewerTiles: DominoTile[];   // fichas del jugador que ve el tablero
  currentUserId: string;
  extraMessage?: string;
}

export function generateDominoBoard(opts: DominoBoardOptions): Buffer {
  const HALF   = 36;   // tamaño de cada mitad de ficha
  const GAP    = 2;
  const BORDER = 3;
  const TILE_W = HALF * 2 + GAP + BORDER * 2;  // ficha horizontal
  const TILE_H = HALF + BORDER * 2;
  const MARGIN = 16;

  // Calcular layout del tablero en serpentina
  // Máximo 10 fichas por fila antes de doblar
  const MAX_PER_ROW = 10;
  const board       = opts.board;

  // Calcular dimensiones del canvas
  const rows      = Math.ceil(Math.max(board.length, 1) / MAX_PER_ROW);
  const boardH    = rows * (TILE_H + MARGIN) + MARGIN;
  const handRows  = Math.ceil(opts.viewerTiles.length / 7);
  const handH     = handRows > 0 ? handRows * (TILE_H + 8) + 40 : 0;
  const infoH     = 80;

  const W = Math.max(TILE_W * MAX_PER_ROW + MARGIN * 2, 700);
  const H = MARGIN + boardH + (handH > 0 ? handH + 20 : 0) + infoH + MARGIN;

  const canvas = createCanvas(W, Math.max(H, 300));
  const ctx    = canvas.getContext('2d');

  // ── Fondo ──────────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1b0d');
  bg.addColorStop(0.5, '#0a1a0a');
  bg.addColorStop(1, '#071207');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Textura de fieltro (puntos sutiles)
  for (let i = 0; i < 200; i++) {
    const px = Math.random() * W;
    const py = Math.random() * H;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.015})`;
    ctx.beginPath();
    ctx.arc(px, py, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Borde exterior
  ctx.strokeStyle = rgba('#ffd700', 0.3);
  ctx.lineWidth   = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // ── Título ─────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
  ctx.fillStyle   = '#ffd700';
  ctx.font        = 'bold 16px sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText('TABLERO DE DOMINÓ', W / 2, 22);
  ctx.restore();

  // Extremos del tablero
  if (opts.game.left_end !== -1) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`◀ ${opts.game.left_end}`, MARGIN, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`${opts.game.right_end} ▶`, W - MARGIN, 22);
  }

  // ── Tablero ────────────────────────────────────────────────────────────────
  const boardStartY = 32;

  if (board.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font      = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tablero vacío — juega la primera ficha', W / 2, boardStartY + 40);
  } else {
    // Layout en serpentina: fila 0 izquierda→derecha, fila 1 derecha→izquierda, etc.
    for (let i = 0; i < board.length; i++) {
      const row     = Math.floor(i / MAX_PER_ROW);
      const col     = i % MAX_PER_ROW;
      const isEven  = row % 2 === 0;
      const actualCol = isEven ? col : (MAX_PER_ROW - 1 - col);

      const tx = MARGIN + actualCol * (TILE_W + MARGIN);
      const ty = boardStartY + row * (TILE_H + MARGIN);

      const tile   = board[i];
      const isLast = i === board.length - 1;
      const isFirst = i === 0;

      drawTile(ctx, tx, ty, HALF, tile.left, tile.right, true, false, isLast || isFirst);
    }

    // Flecha de conexión al final de cada fila (serpentina)
    for (let row = 0; row < rows - 1; row++) {
      const isEven = row % 2 === 0;
      const arrowX = isEven ? W - MARGIN - 8 : MARGIN + 8;
      const arrowY = boardStartY + row * (TILE_H + MARGIN) + TILE_H / 2;
      ctx.fillStyle = rgba('#ffd700', 0.4);
      ctx.font      = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('↓', arrowX, arrowY + 6);
    }
  }

  // ── Mano del jugador ───────────────────────────────────────────────────────
  const handStartY = boardStartY + boardH + 10;

  if (opts.viewerTiles.length > 0) {
    // Separador
    ctx.strokeStyle = rgba('#ffd700', 0.2);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, handStartY);
    ctx.lineTo(W - MARGIN, handStartY);
    ctx.stroke();

    ctx.fillStyle = rgba('#ffd700', 0.7);
    ctx.font      = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`TUS FICHAS (${opts.viewerTiles.length})`, MARGIN, handStartY + 18);

    const leftEnd  = opts.game.left_end;
    const rightEnd = opts.game.right_end;

    for (let i = 0; i < opts.viewerTiles.length; i++) {
      const tile     = opts.viewerTiles[i];
      const row      = Math.floor(i / 7);
      const col      = i % 7;
      const tx       = MARGIN + col * (TILE_W + 8);
      const ty       = handStartY + 26 + row * (TILE_H + 8);
      const playable = leftEnd === -1 || tile.left === leftEnd || tile.right === leftEnd ||
                       tile.left === rightEnd || tile.right === rightEnd;

      drawTile(ctx, tx, ty, HALF, tile.left, tile.right, true, playable, false);

      // Número de ficha
      ctx.fillStyle = playable ? '#ffd700' : 'rgba(255,255,255,0.3)';
      ctx.font      = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), tx + TILE_W / 2, ty + TILE_H + 12);
    }
  }

  // ── Info de jugadores ──────────────────────────────────────────────────────
  const infoStartY = H - infoH - MARGIN + 10;

  ctx.strokeStyle = rgba('#ffd700', 0.15);
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, infoStartY);
  ctx.lineTo(W - MARGIN, infoStartY);
  ctx.stroke();

  const current = opts.players[opts.game.current_pos];
  const colW    = (W - MARGIN * 2) / opts.players.length;

  for (let i = 0; i < opts.players.length; i++) {
    const p       = opts.players[i];
    const isCurr  = current?.user_id === p.user_id;
    const px      = MARGIN + i * colW + colW / 2;
    const py      = infoStartY + 20;

    ctx.textAlign = 'center';

    // Indicador de turno
    if (isCurr) {
      ctx.save();
      ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 10;
      ctx.fillStyle   = '#2ecc71';
      ctx.font        = 'bold 12px sans-serif';
      ctx.fillText('▶ TURNO', px, py);
      ctx.restore();
    }

    // Nombre
    const name = p.is_bot ? 'BOT' : (p.username ?? `J${i + 1}`);
    ctx.fillStyle = isCurr ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.font      = `${isCurr ? 'bold ' : ''}12px sans-serif`;
    ctx.fillText(name.slice(0, 12), px, py + (isCurr ? 18 : 4));

    // Fichas restantes como puntos
    const dotY = py + (isCurr ? 36 : 22);
    const maxDots = Math.min(p.tiles.length, 7);
    for (let d = 0; d < maxDots; d++) {
      const dx = px - (maxDots - 1) * 6 + d * 12;
      ctx.fillStyle = isCurr ? '#ffd700' : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(dx, dotY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.tiles.length > 7) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font      = '10px sans-serif';
      ctx.fillText(`+${p.tiles.length - 7}`, px + maxDots * 6 + 4, dotY + 4);
    }

    // Número total
    ctx.fillStyle = isCurr ? rgba('#ffd700', 0.8) : 'rgba(255,255,255,0.25)';
    ctx.font      = '11px sans-serif';
    ctx.fillText(`${p.tiles.length} fichas`, px, dotY + 18);
  }

  // Mensaje extra (última jugada, etc.)
  if (opts.extraMessage) {
    ctx.fillStyle = rgba('#ffd700', 0.7);
    ctx.font      = '12px sans-serif';
    ctx.textAlign = 'center';
    const clean   = opts.extraMessage.replace(/<@\d+>/g, 'Jugador').replace(/\*\*/g, '');
    ctx.fillText(clean.slice(0, 80), W / 2, H - 10);
  }

  return canvas.toBuffer('image/png');
}
