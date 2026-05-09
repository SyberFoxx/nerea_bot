/**
 * Canvas para el juego de dados (Craps simplificado).
 * Dibuja dos dados 3D con sombras y puntos.
 */
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Posiciones de los puntos para cada cara (en grid 3x3, 0-8)
const DOT_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function drawDie(
  ctx: SKRSContext2D,
  x: number, y: number,
  size: number,
  value: number,
  accentColor: string,
  isHighlight = false,
): void {
  const r = size * 0.12; // radio de esquinas

  // Sombra
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur  = 18;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  // Cara principal
  const faceGrad = ctx.createLinearGradient(x, y, x + size, y + size);
  if (isHighlight) {
    faceGrad.addColorStop(0, '#fffde7');
    faceGrad.addColorStop(0.5, '#fff9c4');
    faceGrad.addColorStop(1, '#f9a825');
  } else {
    faceGrad.addColorStop(0, '#f5f5f5');
    faceGrad.addColorStop(0.5, '#eeeeee');
    faceGrad.addColorStop(1, '#bdbdbd');
  }

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = faceGrad;
  ctx.fill();
  ctx.restore();

  // Borde
  ctx.save();
  ctx.strokeStyle = isHighlight ? rgba(accentColor, 0.8) : 'rgba(0,0,0,0.2)';
  ctx.lineWidth   = isHighlight ? 3 : 1.5;
  if (isHighlight) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur  = 10;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Brillo superior izquierdo
  const shineGrad = ctx.createLinearGradient(x, y, x + size * 0.6, y + size * 0.6);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size * 0.6);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();

  // Puntos
  const dots    = DOT_POSITIONS[value] ?? [];
  const padding = size * 0.18;
  const cell    = (size - padding * 2) / 3;
  const dotR    = size * 0.075;

  for (const pos of dots) {
    const col = pos % 3;
    const row = Math.floor(pos / 3);
    const dx  = x + padding + col * cell + cell / 2;
    const dy  = y + padding + row * cell + cell / 2;

    // Sombra del punto
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const dotGrad = ctx.createRadialGradient(dx - dotR * 0.3, dy - dotR * 0.3, dotR * 0.1, dx, dy, dotR);
    dotGrad.addColorStop(0, isHighlight ? '#e65100' : '#212121');
    dotGrad.addColorStop(1, isHighlight ? '#bf360c' : '#000000');
    ctx.fillStyle = dotGrad;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export interface DiceRenderOptions {
  die1:        number;
  die2:        number;
  accentColor: string;
  won:         boolean;
  result:      'win' | 'lose' | 'neutral';
  label:       string;
  betAmount:   number;
  payout:      number;
  balance:     number;
  username:    string;
  currencyEmoji: string;
  currencyName:  string;
}

export function generateDiceImage(opts: DiceRenderOptions): Buffer {
  const W = 700, H = 300;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const accentColor = opts.won ? '#2ecc71' : '#e74c3c';

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1117');
  bg.addColorStop(1, '#161b22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Borde
  ctx.strokeStyle = rgba(accentColor, 0.5);
  ctx.lineWidth   = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 14);
  ctx.stroke();

  // Franja lateral
  ctx.fillStyle = accentColor;
  roundRect(ctx, 0, 0, 5, H, 3);
  ctx.fill();

  // Decoración de fondo — círculos sutiles
  ctx.fillStyle = rgba(accentColor, 0.04);
  ctx.beginPath(); ctx.arc(W * 0.85, H * 0.2, 120, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.1,  H * 0.8, 80,  0, Math.PI * 2); ctx.fill();

  // Dados
  const dieSize = 110;
  const die1X   = 60,  dieY = (H - dieSize) / 2;
  const die2X   = 200;

  drawDie(ctx, die1X, dieY, dieSize, opts.die1, accentColor, opts.won);
  drawDie(ctx, die2X, dieY, dieSize, opts.die2, accentColor, opts.won);

  // Suma entre los dados
  const sumX = (die1X + dieSize + die2X) / 2;
  ctx.fillStyle    = 'rgba(255,255,255,0.3)';
  ctx.font         = 'bold 28px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', sumX, H / 2);

  // Total
  const total = opts.die1 + opts.die2;
  ctx.save();
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 15;
  ctx.fillStyle   = accentColor;
  ctx.font        = 'bold 52px sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText(String(total), die2X + dieSize + 70, H / 2 - 8);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font      = '13px sans-serif';
  ctx.fillText('TOTAL', die2X + dieSize + 70, H / 2 + 32);

  // Separador
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(die2X + dieSize + 130, 25);
  ctx.lineTo(die2X + dieSize + 130, H - 25);
  ctx.stroke();

  // Info resultado
  const infoX = die2X + dieSize + 150;
  ctx.textAlign = 'left';

  ctx.save();
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = accentColor;
  ctx.font        = 'bold 24px sans-serif';
  ctx.fillText(opts.won ? '✨ ¡GANASTE!' : '💸 Perdiste', infoX, 65);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '13px sans-serif';
  ctx.fillText(opts.label, infoX, 98);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`Apuesta: ${opts.currencyEmoji} ${opts.betAmount.toLocaleString()}`, infoX, 125);

  const changeText = opts.won
    ? `+ ${opts.currencyEmoji} ${opts.payout.toLocaleString()}`
    : `- ${opts.currencyEmoji} ${opts.betAmount.toLocaleString()}`;
  ctx.fillStyle = accentColor;
  ctx.font      = 'bold 20px sans-serif';
  ctx.fillText(changeText, infoX, 158);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font      = '12px sans-serif';
  ctx.fillText(`Saldo: ${opts.currencyEmoji} ${opts.balance.toLocaleString()}`, infoX, 188);
  ctx.fillText(opts.username, infoX, 215);

  return canvas.toBuffer('image/png');
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
