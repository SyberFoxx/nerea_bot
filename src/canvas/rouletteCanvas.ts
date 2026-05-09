/**
 * Canvas de ruleta europea profesional.
 * Dibuja la rueda con todos los números, colores y el marcador.
 */
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

// ─── Datos de la ruleta europea ───────────────────────────────────────────────

// Orden real de los números en la rueda europea
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Colores de cada número
export const NUMBER_COLOR: Record<number, 'red' | 'black' | 'green'> = {
  0: 'green',
  1: 'red',  2: 'black', 3: 'red',  4: 'black', 5: 'red',  6: 'black',
  7: 'red',  8: 'black', 9: 'red',  10: 'black',11: 'black',12: 'red',
  13: 'black',14: 'red', 15: 'black',16: 'red', 17: 'black',18: 'red',
  19: 'red', 20: 'black',21: 'red', 22: 'black',23: 'red', 24: 'black',
  25: 'red', 26: 'black',27: 'red', 28: 'black',29: 'black',30: 'red',
  31: 'black',32: 'red', 33: 'black',34: 'red', 35: 'black',36: 'red',
};

const SLOT_COLORS = {
  red:   '#c0392b',
  black: '#1a1a1a',
  green: '#27ae60',
};

const SLOT_COLORS_BRIGHT = {
  red:   '#e74c3c',
  black: '#2c2c2c',
  green: '#2ecc71',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

export interface RouletteRenderOptions {
  /** Número ganador (0-36). Si es null, dibuja la rueda "girando" (sin resultado). */
  result:    number | null;
  /** Rotación extra en radianes para el efecto de giro */
  rotation?: number;
}

/**
 * Genera la imagen de la ruleta.
 * Si result es null → rueda en movimiento (blur visual).
 * Si result es un número → rueda detenida con el número resaltado.
 */
export function generateRouletteWheel(opts: RouletteRenderOptions): Buffer {
  const SIZE   = 600;
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;
  const R_OUT  = 270;   // radio exterior de los slots
  const R_IN   = 160;   // radio interior (centro de la rueda)
  const R_NUM  = 230;   // radio donde van los números
  const R_BALL = 145;   // radio de la bola

  const canvas = createCanvas(SIZE, SIZE);
  const ctx    = canvas.getContext('2d');

  const slotCount  = WHEEL_ORDER.length; // 37
  const slotAngle  = (Math.PI * 2) / slotCount;
  const baseRot    = opts.rotation ?? 0;

  // ── Fondo ──────────────────────────────────────────────────────────────────
  const bgGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, SIZE / 2);
  bgGrad.addColorStop(0, '#1a1a2e');
  bgGrad.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Sombra exterior de la rueda ────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 40;
  ctx.beginPath();
  ctx.arc(CX, CY, R_OUT + 8, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.restore();

  // ── Anillo exterior dorado ─────────────────────────────────────────────────
  const goldGrad = ctx.createLinearGradient(CX - R_OUT, CY, CX + R_OUT, CY);
  goldGrad.addColorStop(0,   '#b8860b');
  goldGrad.addColorStop(0.3, '#ffd700');
  goldGrad.addColorStop(0.6, '#ffec6e');
  goldGrad.addColorStop(1,   '#b8860b');
  ctx.beginPath();
  ctx.arc(CX, CY, R_OUT + 8, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // ── Slots de la rueda ──────────────────────────────────────────────────────
  const winnerIdx = opts.result !== null
    ? WHEEL_ORDER.indexOf(opts.result)
    : -1;

  for (let i = 0; i < slotCount; i++) {
    const num       = WHEEL_ORDER[i];
    const colorKey  = NUMBER_COLOR[num];
    const startAngle = baseRot + i * slotAngle - slotAngle / 2;
    const endAngle   = startAngle + slotAngle;
    const isWinner   = i === winnerIdx;

    // Slot base
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R_OUT, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isWinner
      ? SLOT_COLORS_BRIGHT[colorKey]
      : SLOT_COLORS[colorKey];
    ctx.fill();

    // Borde entre slots
    ctx.strokeStyle = rgba('#ffd700', 0.35);
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Glow en el ganador
    if (isWinner) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R_OUT, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Número en el slot
    const midAngle = startAngle + slotAngle / 2;
    const nx = CX + Math.cos(midAngle) * R_NUM;
    const ny = CY + Math.sin(midAngle) * R_NUM;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle   = isWinner ? '#ffd700' : 'rgba(255,255,255,0.9)';
    ctx.font        = isWinner ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    if (isWinner) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = 8;
    }
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  }

  // ── Anillo interior (separador) ────────────────────────────────────────────
  // Borde dorado interior
  ctx.beginPath();
  ctx.arc(CX, CY, R_IN + 12, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Separadores radiales dorados
  for (let i = 0; i < slotCount; i++) {
    const angle = baseRot + i * slotAngle;
    ctx.save();
    ctx.strokeStyle = rgba('#ffd700', 0.5);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(angle) * (R_IN + 12), CY + Math.sin(angle) * (R_IN + 12));
    ctx.lineTo(CX + Math.cos(angle) * R_OUT,        CY + Math.sin(angle) * R_OUT);
    ctx.stroke();
    ctx.restore();
  }

  // ── Centro de la rueda ─────────────────────────────────────────────────────
  // Fondo del centro
  const centerGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R_IN + 12);
  centerGrad.addColorStop(0,   '#2c2c2c');
  centerGrad.addColorStop(0.6, '#1a1a1a');
  centerGrad.addColorStop(1,   '#111');
  ctx.beginPath();
  ctx.arc(CX, CY, R_IN + 12, 0, Math.PI * 2);
  ctx.fillStyle = centerGrad;
  ctx.fill();

  // Patrón decorativo del centro — círculos concéntricos
  for (let r = 20; r <= R_IN; r += 25) {
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#ffd700', 0.08 + (r / R_IN) * 0.06);
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  // Líneas decorativas del centro (estrella)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + baseRot * 0.3;
    ctx.save();
    ctx.strokeStyle = rgba('#ffd700', 0.12);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(angle) * (R_IN - 10), CY + Math.sin(angle) * (R_IN - 10));
    ctx.stroke();
    ctx.restore();
  }

  // Logo central
  ctx.save();
  ctx.shadowColor = rgba('#ffd700', 0.6);
  ctx.shadowBlur  = 15;
  ctx.fillStyle   = '#ffd700';
  ctx.font        = 'bold 22px sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎰', CX, CY - 12);
  ctx.font        = 'bold 14px sans-serif';
  ctx.fillStyle   = rgba('#ffd700', 0.8);
  ctx.fillText('RULETA', CX, CY + 14);
  ctx.restore();

  // ── Marcador (flecha en la parte superior) ─────────────────────────────────
  const markerY = CY - R_OUT - 2;
  ctx.save();
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(CX,      markerY + 2);
  ctx.lineTo(CX - 10, markerY - 18);
  ctx.lineTo(CX + 10, markerY - 18);
  ctx.closePath();
  ctx.fill();
  // Punta brillante
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(CX, markerY - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Bola (solo si hay resultado) ───────────────────────────────────────────
  if (opts.result !== null && winnerIdx >= 0) {
    const ballAngle = baseRot + winnerIdx * slotAngle;
    const bx = CX + Math.cos(ballAngle) * R_BALL;
    const by = CY + Math.sin(ballAngle) * R_BALL;

    // Sombra de la bola
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = '#e0e0e0';
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bola blanca con gradiente
    const ballGrad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 11);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.4, '#e8e8e8');
    ballGrad.addColorStop(1, '#aaaaaa');
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Brillo de la bola
    ctx.beginPath();
    ctx.arc(bx - 3, by - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Glow dorado alrededor de la bola
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 15;
    ctx.strokeStyle = rgba('#ffd700', 0.8);
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Efecto de movimiento (si no hay resultado) ─────────────────────────────
  if (opts.result === null) {
    // Overlay de blur radial para simular movimiento
    const motionGrad = ctx.createRadialGradient(CX, CY, R_IN + 12, CX, CY, R_OUT);
    motionGrad.addColorStop(0,   'rgba(0,0,0,0)');
    motionGrad.addColorStop(0.3, 'rgba(0,0,0,0)');
    motionGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    motionGrad.addColorStop(1,   'rgba(0,0,0,0.3)');
    ctx.fillStyle = motionGrad;
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUT, 0, Math.PI * 2);
    ctx.fill();

    // Texto "Girando..."
    ctx.save();
    ctx.fillStyle   = 'rgba(255,255,255,0.7)';
    ctx.font        = 'bold 16px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 6;
    ctx.fillText('⟳ Girando...', CX, CY + 45);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

// ─── Mesa de apuestas ─────────────────────────────────────────────────────────

export interface BetTableOptions {
  bet:        Roulettebet;
  result:     number;
  won:        boolean;
  payout:     number;
  betAmount:  number;
  balance:    number;
  username:   string;
  currencyEmoji: string;
  currencyName:  string;
}

export function generateBetTable(opts: BetTableOptions): Buffer {
  const W = 700, H = 220;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const accentColor = opts.won ? '#2ecc71' : '#e74c3c';
  const resultColor = NUMBER_COLOR[opts.result];
  const resultHex   = resultColor === 'red' ? '#e74c3c' : resultColor === 'black' ? '#2c2c2c' : '#27ae60';

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1117');
  bg.addColorStop(1, '#161b22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Borde con color de resultado
  ctx.strokeStyle = rgba(accentColor, 0.6);
  ctx.lineWidth   = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 12);
  ctx.stroke();

  // Franja lateral
  ctx.fillStyle = accentColor;
  roundRect(ctx, 0, 0, 5, H, 3);
  ctx.fill();

  // Número resultado — círculo grande
  const numR = 55;
  const numX = 80, numY = H / 2;
  ctx.save();
  ctx.shadowColor = resultHex;
  ctx.shadowBlur  = 20;
  ctx.beginPath();
  ctx.arc(numX, numY, numR, 0, Math.PI * 2);
  ctx.fillStyle = resultHex;
  ctx.fill();
  ctx.restore();

  // Borde del círculo
  ctx.strokeStyle = rgba('#ffd700', 0.7);
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(numX, numY, numR, 0, Math.PI * 2);
  ctx.stroke();

  // Número dentro del círculo
  ctx.fillStyle    = '#ffffff';
  ctx.font         = `bold ${opts.result >= 10 ? '36px' : '42px'} sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(opts.result), numX, numY);

  // Color del número debajo
  const colorLabel = resultColor === 'red' ? '🔴 Rojo' : resultColor === 'black' ? '⚫ Negro' : '🟢 Verde';
  ctx.fillStyle    = 'rgba(255,255,255,0.5)';
  ctx.font         = '12px sans-serif';
  ctx.fillText(colorLabel, numX, numY + numR + 14);

  // Separador vertical
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(155, 20);
  ctx.lineTo(155, H - 20);
  ctx.stroke();

  // Info de la apuesta
  ctx.textAlign = 'left';
  const infoX   = 175;

  // Título resultado
  ctx.save();
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = accentColor;
  ctx.font        = 'bold 26px sans-serif';
  ctx.fillText(opts.won ? '✨ ¡GANASTE!' : '💸 Perdiste', infoX, 52);
  ctx.restore();

  // Apuesta realizada
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`Apostaste: ${opts.currencyEmoji} ${opts.betAmount.toLocaleString()} en "${formatBetLabel(opts.bet)}"`, infoX, 82);

  // Ganancia/pérdida
  const changeText = opts.won
    ? `+ ${opts.currencyEmoji} ${opts.payout.toLocaleString()} ${opts.currencyName}`
    : `- ${opts.currencyEmoji} ${opts.betAmount.toLocaleString()} ${opts.currencyName}`;

  ctx.fillStyle = accentColor;
  ctx.font      = 'bold 20px sans-serif';
  ctx.fillText(changeText, infoX, 116);

  // Saldo actual
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`Saldo: ${opts.currencyEmoji} ${opts.balance.toLocaleString()}`, infoX, 146);

  // Usuario
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font      = '12px sans-serif';
  ctx.fillText(opts.username, infoX, 175);

  // Multiplicador
  if (opts.won) {
    const mult = getBetMultiplier(opts.bet);
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba('#ffd700', 0.7);
    ctx.font      = 'bold 14px sans-serif';
    ctx.fillText(`×${mult}`, W - 20, 52);
    ctx.fillStyle = rgba('#ffd700', 0.4);
    ctx.font      = '11px sans-serif';
    ctx.fillText('multiplicador', W - 20, 68);
  }

  return canvas.toBuffer('image/png');
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

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

export type Roulettebet =
  | { type: 'number';  value: number }
  | { type: 'color';   value: 'red' | 'black' | 'green' }
  | { type: 'parity';  value: 'even' | 'odd' }
  | { type: 'half';    value: 'low' | 'high' }
  | { type: 'dozen';   value: 1 | 2 | 3 }
  | { type: 'column';  value: 1 | 2 | 3 };

export function getBetMultiplier(bet: Roulettebet): number {
  switch (bet.type) {
    case 'number': return 35;
    case 'color':  return bet.value === 'green' ? 35 : 1;
    case 'parity': return 1;
    case 'half':   return 1;
    case 'dozen':  return 2;
    case 'column': return 2;
  }
}

export function checkWin(bet: Roulettebet, result: number): boolean {
  const color  = NUMBER_COLOR[result];
  switch (bet.type) {
    case 'number': return bet.value === result;
    case 'color':  return color === bet.value;
    case 'parity':
      if (result === 0) return false;
      return bet.value === 'even' ? result % 2 === 0 : result % 2 !== 0;
    case 'half':
      if (result === 0) return false;
      return bet.value === 'low' ? result <= 18 : result >= 19;
    case 'dozen':
      if (result === 0) return false;
      return bet.value === 1 ? result <= 12 : bet.value === 2 ? result <= 24 : result <= 36;
    case 'column':
      if (result === 0) return false;
      return result % 3 === (bet.value === 3 ? 0 : bet.value);
  }
}

export function formatBetLabel(bet: Roulettebet): string {
  switch (bet.type) {
    case 'number': return `Número ${bet.value}`;
    case 'color':  return bet.value === 'red' ? 'Rojo' : bet.value === 'black' ? 'Negro' : 'Verde (0)';
    case 'parity': return bet.value === 'even' ? 'Par' : 'Impar';
    case 'half':   return bet.value === 'low' ? 'Bajo (1-18)' : 'Alto (19-36)';
    case 'dozen':  return `${bet.value}ª Docena`;
    case 'column': return `Columna ${bet.value}`;
  }
}
