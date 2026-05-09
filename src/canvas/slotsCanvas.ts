/**
 * Canvas para tragamonedas (Slots).
 * Dibuja 3 carretes con símbolos usando formas canvas (sin emojis).
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

// ─── Símbolos ─────────────────────────────────────────────────────────────────

export const SLOT_SYMBOLS = [
  { emoji: '🍒', label: 'CEREZA',   symbol: 'cherry',   weight: 30, multiplier: 2,  color: '#e74c3c', bg: '#c0392b' },
  { emoji: '🍋', label: 'LIMÓN',    symbol: 'lemon',    weight: 25, multiplier: 3,  color: '#f1c40f', bg: '#d4ac0d' },
  { emoji: '🍊', label: 'NARANJA',  symbol: 'orange',   weight: 20, multiplier: 4,  color: '#e67e22', bg: '#ca6f1e' },
  { emoji: '🍇', label: 'UVAS',     symbol: 'grape',    weight: 15, multiplier: 5,  color: '#9b59b6', bg: '#7d3c98' },
  { emoji: '🔔', label: 'CAMPANA',  symbol: 'bell',     weight: 6,  multiplier: 10, color: '#f39c12', bg: '#d68910' },
  { emoji: '⭐', label: 'ESTRELLA', symbol: 'star',     weight: 3,  multiplier: 20, color: '#ffd700', bg: '#b8860b' },
  { emoji: '💎', label: 'DIAMANTE', symbol: 'diamond',  weight: 1,  multiplier: 50, color: '#00d2ff', bg: '#0099cc' },
] as const;

export type SlotSymbol = typeof SLOT_SYMBOLS[number];

export function spinReel(): SlotSymbol {
  const total = SLOT_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let rand = Math.random() * total;
  for (const sym of SLOT_SYMBOLS) {
    rand -= sym.weight;
    if (rand <= 0) return sym;
  }
  return SLOT_SYMBOLS[0];
}

export interface SlotsResult {
  reels:      [SlotSymbol, SlotSymbol, SlotSymbol];
  won:        boolean;
  multiplier: number;
  isJackpot:  boolean;
  isTwoMatch: boolean;
}

export function evaluateSlots(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): SlotsResult {
  const [a, b, c] = reels;
  const isJackpot  = a.symbol === b.symbol && b.symbol === c.symbol;
  const isTwoMatch = !isJackpot && (a.symbol === b.symbol || b.symbol === c.symbol || a.symbol === c.symbol);
  let multiplier   = 0;
  if (isJackpot)  multiplier = a.multiplier;
  if (isTwoMatch) multiplier = Math.max(1, Math.floor(a.multiplier * 0.3));
  return { reels, won: isJackpot || isTwoMatch, multiplier, isJackpot, isTwoMatch };
}

// ─── Dibujadores de símbolos ──────────────────────────────────────────────────

function drawSymbol(ctx: SKRSContext2D, sym: SlotSymbol, cx: number, cy: number, size: number) {
  const s = size * 0.38;
  ctx.save();
  ctx.translate(cx, cy);

  switch (sym.symbol) {

    case 'cherry': {
      // Dos círculos rojos (cerezas) con tallo
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth   = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.5, -s * 1.1, s * 0.3, -s * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.5, -s * 1.1, -s * 0.3, -s * 0.9);
      ctx.stroke();
      // Cerezas
      for (const [ox, oy] of [[s * 0.3, 0], [-s * 0.3, 0]] as [number, number][]) {
        const g = ctx.createRadialGradient(ox - s * 0.1, oy - s * 0.1, s * 0.05, ox, oy, s * 0.38);
        g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#c0392b');
        ctx.beginPath(); ctx.arc(ox, oy, s * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(ox - s * 0.1, oy - s * 0.1, s * 0.1, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }

    case 'lemon': {
      // Elipse amarilla con textura
      ctx.save();
      ctx.scale(1, 0.75);
      const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s * 0.9);
      g.addColorStop(0, '#fff176'); g.addColorStop(0.6, '#f9a825'); g.addColorStop(1, '#e65100');
      ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      // Puntas
      ctx.fillStyle = '#f9a825';
      ctx.beginPath(); ctx.ellipse(-s * 0.75, 0, s * 0.2, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( s * 0.75, 0, s * 0.2, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.25, s * 0.2, s * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'orange': {
      const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s);
      g.addColorStop(0, '#ffcc80'); g.addColorStop(0.5, '#ff9800'); g.addColorStop(1, '#e65100');
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      // Hoja
      ctx.fillStyle = '#388e3c';
      ctx.beginPath(); ctx.ellipse(0, -s * 1.05, s * 0.18, s * 0.35, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.3, s * 0.22, s * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'grape': {
      // Racimo de uvas (7 círculos)
      const positions = [
        [0, -s * 0.7], [-s * 0.4, -s * 0.3], [s * 0.4, -s * 0.3],
        [-s * 0.6, s * 0.15], [0, s * 0.15], [s * 0.6, s * 0.15],
        [0, s * 0.65],
      ] as [number, number][];
      for (const [gx, gy] of positions) {
        const g = ctx.createRadialGradient(gx - s * 0.08, gy - s * 0.08, s * 0.03, gx, gy, s * 0.3);
        g.addColorStop(0, '#ce93d8'); g.addColorStop(1, '#6a1b9a');
        ctx.beginPath(); ctx.arc(gx, gy, s * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(gx - s * 0.08, gy - s * 0.08, s * 0.08, 0, Math.PI * 2); ctx.fill();
      }
      // Tallo
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = s * 0.1;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, -s * 1.3); ctx.stroke();
      break;
    }

    case 'bell': {
      // Campana
      ctx.fillStyle = '#f9a825';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(-s * 0.1, -s, -s * 0.9, -s * 0.3, -s * 0.9, s * 0.3);
      ctx.lineTo(s * 0.9, s * 0.3);
      ctx.bezierCurveTo(s * 0.9, -s * 0.3, s * 0.1, -s, 0, -s);
      ctx.fill();
      // Borde inferior
      ctx.fillStyle = '#e65100';
      ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.9, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // Badajo
      ctx.fillStyle = '#5d4037';
      ctx.beginPath(); ctx.arc(0, s * 0.6, s * 0.15, 0, Math.PI * 2); ctx.fill();
      // Brillo
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.4, s * 0.2, s * 0.35, -0.4, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'star': {
      // Estrella de 5 puntas
      const outerR = s, innerR = s * 0.42;
      const g = ctx.createRadialGradient(0, 0, innerR * 0.3, 0, 0, outerR);
      g.addColorStop(0, '#fff176'); g.addColorStop(0.5, '#ffd700'); g.addColorStop(1, '#f57f17');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r     = i % 2 === 0 ? outerR : innerR;
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else         ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#f57f17', 0.5); ctx.lineWidth = s * 0.05; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.35, s * 0.18, s * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case 'diamond': {
      // Diamante con facetas
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, -s * 0.2);
      ctx.lineTo(s * 0.7, s * 0.2);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, s * 0.2);
      ctx.lineTo(-s * 0.7, -s * 0.2);
      ctx.closePath();
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#e0f7fa'); g.addColorStop(0.3, '#00d2ff');
      g.addColorStop(0.6, '#0099cc'); g.addColorStop(1, '#006994');
      ctx.fillStyle = g; ctx.fill();
      // Facetas internas
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(-s * 0.7, 0); ctx.stroke();
      // Brillo
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.35, -s * 0.1); ctx.lineTo(0, -s * 0.3); ctx.closePath(); ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// ─── Canvas principal ─────────────────────────────────────────────────────────

export interface SlotsRenderOptions {
  reels:         [SlotSymbol, SlotSymbol, SlotSymbol];
  result:        SlotsResult;
  betAmount:     number;
  payout:        number;
  balance:       number;
  username:      string;
  currencyEmoji: string;
  currencyName:  string;
}

export function generateSlotsImage(opts: SlotsRenderOptions): Buffer {
  const W = 800, H = 440;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const { result } = opts;

  const accentColor = result.isJackpot ? '#ffd700'
    : result.isTwoMatch ? '#2ecc71'
    : '#e74c3c';

  // ── Fondo ──────────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0a2e');
  bg.addColorStop(0.5, '#16213e');
  bg.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Luces de casino (top y bottom)
  const lightColors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 14; i++) {
    const lx    = (i / 13) * W;
    const color = lightColors[i % lightColors.length];
    for (const ly of [0, H]) {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 55);
      g.addColorStop(0, rgba(color, 0.35));
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Título ─────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18;
  ctx.fillStyle   = '#ffd700';
  ctx.font        = 'bold 26px sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText('LUCKY SLOTS', W / 2, 40);
  ctx.restore();

  // Líneas decorativas del título
  for (const [x1, x2] of [[60, W / 2 - 90], [W / 2 + 90, W - 60]] as [number, number][]) {
    const lg = ctx.createLinearGradient(x1, 0, x2, 0);
    lg.addColorStop(0, 'transparent'); lg.addColorStop(0.5, rgba('#ffd700', 0.6)); lg.addColorStop(1, 'transparent');
    ctx.fillStyle = lg; ctx.fillRect(x1, 32, x2 - x1, 2);
  }

  // ── Cuerpo de la máquina ───────────────────────────────────────────────────
  const mX = 60, mY = 55, mW = W - 120, mH = 240;
  const mGrad = ctx.createLinearGradient(mX, mY, mX, mY + mH);
  mGrad.addColorStop(0, '#2c1654'); mGrad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = mGrad;
  roundRect(ctx, mX, mY, mW, mH, 18); ctx.fill();
  ctx.strokeStyle = rgba('#ffd700', 0.55); ctx.lineWidth = 3;
  roundRect(ctx, mX, mY, mW, mH, 18); ctx.stroke();

  // ── Carretes ──────────────────────────────────────────────────────────────
  const reelW = 170, reelH = 180, reelGap = 18;
  const totalW = reelW * 3 + reelGap * 2;
  const rX0    = (W - totalW) / 2;
  const rY     = mY + (mH - reelH) / 2;

  for (let i = 0; i < 3; i++) {
    const rx  = rX0 + i * (reelW + reelGap);
    const sym = opts.reels[i];

    // ¿Este carrete es parte de la combinación ganadora?
    const [a, b, c] = opts.reels;
    const isWin = result.isJackpot || (result.isTwoMatch && (
      (i === 0 && (a.symbol === b.symbol || a.symbol === c.symbol)) ||
      (i === 1 && (b.symbol === a.symbol || b.symbol === c.symbol)) ||
      (i === 2 && (c.symbol === a.symbol || c.symbol === b.symbol))
    ));

    // Fondo del carrete
    const rGrad = ctx.createLinearGradient(rx, rY, rx, rY + reelH);
    if (isWin) {
      rGrad.addColorStop(0, '#fffde7'); rGrad.addColorStop(0.5, '#fff9c4'); rGrad.addColorStop(1, '#fff176');
    } else {
      rGrad.addColorStop(0, '#f5f5f5'); rGrad.addColorStop(0.5, '#eeeeee'); rGrad.addColorStop(1, '#d0d0d0');
    }
    ctx.fillStyle = rGrad;
    roundRect(ctx, rx, rY, reelW, reelH, 12); ctx.fill();

    // Borde del carrete
    if (isWin) {
      ctx.save();
      ctx.shadowColor = sym.color; ctx.shadowBlur = 22;
      ctx.strokeStyle = sym.color; ctx.lineWidth = 3;
      roundRect(ctx, rx, rY, reelW, reelH, 12); ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
      roundRect(ctx, rx, rY, reelW, reelH, 12); ctx.stroke();
    }

    // Líneas de carrete
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
    for (let l = 1; l < 4; l++) {
      const ly = rY + (reelH / 4) * l;
      ctx.beginPath(); ctx.moveTo(rx + 8, ly); ctx.lineTo(rx + reelW - 8, ly); ctx.stroke();
    }

    // Símbolo dibujado
    const symCX = rx + reelW / 2;
    const symCY = rY + reelH / 2 - 14;
    drawSymbol(ctx, sym, symCX, symCY, reelW * 0.55);

    // Glow de fondo en ganador
    if (isWin) {
      const gGrad = ctx.createRadialGradient(symCX, symCY, 10, symCX, symCY, reelW * 0.6);
      gGrad.addColorStop(0, rgba(sym.color, 0.18)); gGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = gGrad;
      roundRect(ctx, rx, rY, reelW, reelH, 12); ctx.fill();
    }

    // Etiqueta del símbolo
    ctx.fillStyle    = isWin ? sym.color : 'rgba(0,0,0,0.45)';
    ctx.font         = `bold 12px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(sym.label, symCX, rY + reelH - 12);
  }

  // ── Línea de pago ──────────────────────────────────────────────────────────
  const lineY = rY + reelH / 2;
  ctx.save();
  if (result.won) { ctx.shadowColor = accentColor; ctx.shadowBlur = 10; }
  ctx.strokeStyle = result.won ? rgba(accentColor, 0.85) : 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = result.won ? 3 : 1;
  ctx.setLineDash(result.won ? [] : [8, 4]);
  ctx.beginPath(); ctx.moveTo(mX + 14, lineY); ctx.lineTo(mX + mW - 14, lineY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Resultado ─────────────────────────────────────────────────────────────
  const resY = mY + mH + 22;
  ctx.textAlign = 'center';

  if (result.isJackpot) {
    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 28;
    ctx.fillStyle   = '#ffd700';
    ctx.font        = 'bold 30px sans-serif';
    ctx.fillText('*** JACKPOT ***', W / 2, resY + 28);
    ctx.restore();
    ctx.fillStyle = rgba('#ffd700', 0.7);
    ctx.font      = '15px sans-serif';
    ctx.fillText(`x${result.multiplier} — Tres ${opts.reels[0].label}`, W / 2, resY + 54);
  } else if (result.isTwoMatch) {
    ctx.save();
    ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 12;
    ctx.fillStyle   = '#2ecc71';
    ctx.font        = 'bold 24px sans-serif';
    ctx.fillText('Dos iguales!', W / 2, resY + 28);
    ctx.restore();
    ctx.fillStyle = rgba('#2ecc71', 0.7);
    ctx.font      = '14px sans-serif';
    ctx.fillText(`x${result.multiplier}`, W / 2, resY + 52);
  } else {
    ctx.fillStyle = rgba('#e74c3c', 0.8);
    ctx.font      = 'bold 22px sans-serif';
    ctx.fillText('Sin suerte esta vez...', W / 2, resY + 28);
  }

  // ── Info de apuesta ────────────────────────────────────────────────────────
  const infoY = resY + 78;
  const changeText = result.won
    ? `${opts.currencyEmoji} +${opts.payout.toLocaleString()} ${opts.currencyName}`
    : `${opts.currencyEmoji} -${opts.betAmount.toLocaleString()} ${opts.currencyName}`;

  ctx.save();
  ctx.shadowColor = accentColor; ctx.shadowBlur = 8;
  ctx.fillStyle   = accentColor;
  ctx.font        = 'bold 20px sans-serif';
  ctx.fillText(changeText, W / 2, infoY);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font      = '12px sans-serif';
  ctx.fillText(
    `Saldo: ${opts.currencyEmoji} ${opts.balance.toLocaleString()}  |  ${opts.username}`,
    W / 2, infoY + 26
  );

  return canvas.toBuffer('image/png');
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
