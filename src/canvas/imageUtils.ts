import { createCanvas, loadImage, GlobalFonts, Canvas, SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Descarga una imagen desde una URL y la devuelve como Image */
async function fetchImage(url: string) {
  return loadImage(url);
}

/** Dibuja un rectángulo redondeado */
function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

/** Dibuja un avatar circular con borde de color */
async function drawAvatar(ctx: SKRSContext2D, url: string, x: number, y: number, size: number, borderColor = '#ffffff', borderWidth = 4): Promise<void> {
  const img = await fetchImage(url);

  // Borde exterior
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Clip circular para el avatar
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

/** Aplica un blur/oscurecimiento sobre el fondo */
function darkenBackground(ctx: SKRSContext2D, w: number, h: number, alpha = 0.55): void {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

// ─── Tarjeta de Perfil ────────────────────────────────────────────────────────

export interface ProfileCardOptions {
  username:    string;
  discriminator?: string;
  avatarUrl:   string;
  level:       number;
  xp:          number;
  xpNeeded:    number;
  rank:        number;
  accentColor: string; // hex, ej: '#3498db'
  joinedAt:    string;
  roles:       string[];
}

export async function generateProfileCard(opts: ProfileCardOptions): Promise<Buffer> {
  const W = 900, H = 280;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Fondo degradado ──────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(0.5, '#16213e');
  bg.addColorStop(1, '#0f3460');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Panel izquierdo (avatar) ─────────────────────────────────────────────
  const panelW = 220;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 0, 0, panelW, H, 0);
  ctx.fill();

  // Avatar
  await drawAvatar(ctx, opts.avatarUrl, 35, 40, 150, opts.accentColor, 5);

  // Nombre bajo el avatar
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(opts.username, panelW / 2, 215, panelW - 20);

  // Rank badge
  ctx.fillStyle = opts.accentColor;
  roundRect(ctx, 55, 225, 110, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 14px sans-serif';
  ctx.fillText(`# ${opts.rank}`, panelW / 2, 244);

  // ── Panel derecho (stats) ────────────────────────────────────────────────
  const px = panelW + 30;
  ctx.textAlign = 'left';

  // Nivel grande
  ctx.fillStyle = opts.accentColor;
  ctx.font      = 'bold 64px sans-serif';
  ctx.fillText(`${opts.level}`, px, 80);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '20px sans-serif';
  ctx.fillText('NIVEL', px + 5, 100);

  // XP
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 16px sans-serif';
  ctx.fillText(`${opts.xp.toLocaleString()} / ${opts.xpNeeded.toLocaleString()} XP`, px, 130);

  // Barra de progreso
  const barX = px, barY = 145, barW = W - px - 30, barH = 18;
  const pct  = Math.min(opts.xp / opts.xpNeeded, 1);

  // Fondo barra
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();

  // Progreso
  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, opts.accentColor);
    grad.addColorStop(1, lightenColor(opts.accentColor, 40));
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, Math.max(barW * pct, barH), barH, barH / 2);
    ctx.fill();

    // Brillo en la barra
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, barX, barY, Math.max(barW * pct, barH), barH / 2, barH / 4);
    ctx.fill();
  }

  // Porcentaje
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font      = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(pct * 100)}%`, barX + barW, barY - 4);
  ctx.textAlign = 'left';

  // Separador
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(px, 180);
  ctx.lineTo(W - 20, 180);
  ctx.stroke();

  // Info adicional
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '13px sans-serif';
  ctx.fillText('📅 Se unió:', px, 205);
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText(opts.joinedAt, px + 80, 205);

  if (opts.roles.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = '13px sans-serif';
    ctx.fillText('🎭 Roles:', px, 230);
    ctx.fillStyle = opts.accentColor;
    ctx.font      = 'bold 13px sans-serif';
    const rolesText = opts.roles.slice(0, 4).join(', ') + (opts.roles.length > 4 ? ` +${opts.roles.length - 4}` : '');
    ctx.fillText(rolesText, px + 65, 230, W - px - 65 - 20);
  }

  // Borde decorativo izquierdo
  ctx.fillStyle = opts.accentColor;
  ctx.fillRect(0, 0, 4, H);

  return canvas.toBuffer('image/png');
}

// ─── Tarjeta de Nivel (Rank Card) ─────────────────────────────────────────────

export interface RankCardOptions {
  username:   string;
  avatarUrl:  string;
  level:      number;
  xp:         number;
  xpNeeded:   number;
  rank:       number;
  accentColor: string;
}

export async function generateRankCard(opts: RankCardOptions): Promise<Buffer> {
  const W = 800, H = 200;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2c2f33');
  bg.addColorStop(1, '#23272a');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Avatar
  await drawAvatar(ctx, opts.avatarUrl, 25, 25, 150, opts.accentColor, 4);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(opts.username, 200, 65, 380);

  // Rank
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '18px sans-serif';
  ctx.fillText('RANK', W - 20, 50);
  ctx.fillStyle = opts.accentColor;
  ctx.font      = 'bold 36px sans-serif';
  ctx.fillText(`#${opts.rank}`, W - 20, 85);

  // Level
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '18px sans-serif';
  ctx.fillText('NIVEL', W - 120, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 36px sans-serif';
  ctx.fillText(`${opts.level}`, W - 120, 85);

  // XP text
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font      = '14px sans-serif';
  ctx.fillText(`${opts.xp.toLocaleString()} / ${opts.xpNeeded.toLocaleString()} XP`, W - 20, 125);

  // Barra de progreso
  const barX = 200, barY = 135, barW = W - 220, barH = 22;
  const pct  = Math.min(opts.xp / opts.xpNeeded, 1);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();

  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, opts.accentColor);
    grad.addColorStop(1, lightenColor(opts.accentColor, 50));
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, Math.max(barW * pct, barH), barH, barH / 2);
    ctx.fill();

    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(ctx, barX, barY, Math.max(barW * pct, barH), barH / 2, barH / 4);
    ctx.fill();

    // Indicador de posición
    const dotX = barX + barW * pct;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.min(dotX, barX + barW - barH / 2), barY + barH / 2, barH / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Porcentaje
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`${Math.floor(pct * 100)}%`, barX, barY + barH + 18);

  return canvas.toBuffer('image/png');
}

// ─── Tarjeta de Bienvenida ────────────────────────────────────────────────────

export interface WelcomeCardOptions {
  username:    string;
  avatarUrl:   string;
  memberCount: number;
  guildName:   string;
  accentColor?: string;
  backgroundUrl?: string;
}

export async function generateWelcomeCard(opts: WelcomeCardOptions): Promise<Buffer> {
  const W = 1000, H = 400;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const accent = opts.accentColor ?? '#3498db';

  // Fondo
  if (opts.backgroundUrl) {
    try {
      const bg = await fetchImage(opts.backgroundUrl);
      ctx.drawImage(bg, 0, 0, W, H);
      darkenBackground(ctx, W, H, 0.6);
    } catch {
      drawDefaultBackground(ctx, W, H, accent);
    }
  } else {
    drawDefaultBackground(ctx, W, H, accent);
  }

  // Línea decorativa superior
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, 'transparent');
  lineGrad.addColorStop(0.3, accent);
  lineGrad.addColorStop(0.7, accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, H - 4, W, 4);

  // Avatar centrado
  const avatarSize = 160;
  const avatarX    = (W - avatarSize) / 2;
  const avatarY    = 50;
  await drawAvatar(ctx, opts.avatarUrl, avatarX, avatarY, avatarSize, accent, 6);

  // Texto "¡BIENVENIDO/A!"
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font      = 'bold 22px sans-serif';
  ctx.fillText('¡BIENVENIDO/A!', W / 2, avatarY + avatarSize + 45);

  // Nombre de usuario
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 42px sans-serif';
  ctx.fillText(opts.username, W / 2, avatarY + avatarSize + 95, W - 100);

  // Servidor
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font      = '20px sans-serif';
  ctx.fillText(`a ${opts.guildName}`, W / 2, avatarY + avatarSize + 130);

  // Contador de miembros
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '16px sans-serif';
  ctx.fillText(`Eres el miembro #${opts.memberCount.toLocaleString()}`, W / 2, avatarY + avatarSize + 165);

  return canvas.toBuffer('image/png');
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function drawDefaultBackground(ctx: SKRSContext2D, w: number, h: number, accent: string): void {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(0.5, '#16213e');
  bg.addColorStop(1, '#0f3460');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Círculos decorativos de fondo
  ctx.fillStyle = `${accent}15`;
  ctx.beginPath(); ctx.arc(w * 0.1, h * 0.2, 120, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.9, h * 0.8, 100, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `${accent}08`;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 1.1, 200, 0, Math.PI * 2); ctx.fill();
}

/** Aclara un color hex */
function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, (num >> 16) + amount);
  const g   = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b   = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
