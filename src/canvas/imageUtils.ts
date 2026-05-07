import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProfileCardOptions {
  username:    string;
  avatarUrl:   string;
  level:       number;
  xp:          number;
  xpNeeded:    number;
  rank:        number;
  accentColor: string;
  joinedAt:    string;
  roles:       string[];
}

export interface RankCardOptions {
  username:    string;
  avatarUrl:   string;
  level:       number;
  xp:          number;
  xpNeeded:    number;
  rank:        number;
  accentColor: string;
}

export interface WelcomeCardOptions {
  username:       string;
  avatarUrl:      string;
  memberCount:    number;
  guildName:      string;
  accentColor?:   string;
  backgroundUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  const c = (v: number) => Math.min(255, Math.max(0, v + amt)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

async function drawCircularAvatar(
  ctx: SKRSContext2D,
  url: string,
  cx: number, cy: number,
  radius: number,
  borderColor: string,
  borderWidth = 4
): Promise<void> {
  const img = await loadImage(url);

  // Glow suave
  ctx.save();
  ctx.shadowColor = rgba(borderColor, 0.5);
  ctx.shadowBlur  = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + borderWidth + 2, 0, Math.PI * 2);
  ctx.fillStyle = 'transparent';
  ctx.fill();
  ctx.restore();

  // Borde de color
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Borde oscuro interior
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // Avatar
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawProgressBar(
  ctx: SKRSContext2D,
  x: number, y: number, w: number, h: number,
  pct: number,
  accentColor: string
): void {
  const r = h / 2;

  // Fondo
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Borde sutil
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  if (pct <= 0) return;

  const fillW = Math.max(w * pct, h);

  // Gradiente de relleno
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(0.7, lighten(accentColor, 35));
  grad.addColorStop(1, lighten(accentColor, 60));
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, fillW, h, r);
  ctx.fill();

  // Brillo superior
  const shine = ctx.createLinearGradient(0, y, 0, y + h);
  shine.addColorStop(0, 'rgba(255,255,255,0.22)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  roundRect(ctx, x, y, fillW, h / 2, r);
  ctx.fill();

  // Punto indicador al final de la barra
  const dotX = Math.min(x + fillW, x + w - r);
  ctx.save();
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(dotX, y + h / 2, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlass(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number, alpha = 0.07): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawParticles(ctx: SKRSContext2D, w: number, h: number, accent: string, seed = 42): void {
  const { r, g, b } = hexToRgb(accent);
  const rng = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  for (let i = 0; i < 16; i++) {
    const px    = rng(seed + i * 3.1) * w;
    const py    = rng(seed + i * 7.3) * h;
    const size  = rng(seed + i * 2.7) * 2.5 + 0.8;
    const alpha = rng(seed + i * 5.9) * 0.25 + 0.04;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Tarjeta de Perfil ────────────────────────────────────────────────────────

export async function generateProfileCard(opts: ProfileCardOptions): Promise<Buffer> {
  const W = 960, H = 340;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const accent = opts.accentColor;
  const { r, g, b } = hexToRgb(accent);

  // ── Fondo ────────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0d0d1a');
  bgGrad.addColorStop(1, '#111128');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Círculos decorativos
  ctx.fillStyle = `rgba(${r},${g},${b},0.07)`;
  ctx.beginPath(); ctx.arc(W * 0.88, H * 0.18, 170, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${r},${g},${b},0.04)`;
  ctx.beginPath(); ctx.arc(W * 0.08, H * 0.85, 120, 0, Math.PI * 2); ctx.fill();

  drawParticles(ctx, W, H, accent);

  // Borde lateral izquierdo con gradiente
  const sideGrad = ctx.createLinearGradient(0, 0, 0, H);
  sideGrad.addColorStop(0, accent);
  sideGrad.addColorStop(0.5, lighten(accent, 40));
  sideGrad.addColorStop(1, accent);
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, 5, H);

  // ── Panel izquierdo ──────────────────────────────────────────────────────
  const panelW = 210;
  drawGlass(ctx, 5, 0, panelW - 5, H, 0, 0.05);

  // Avatar centrado en el panel
  const avatarCX = panelW / 2 + 2;
  const avatarCY = 130;
  await drawCircularAvatar(ctx, opts.avatarUrl, avatarCX, avatarCY, 78, accent, 5);

  // Badge de nivel (esquina inferior derecha del avatar)
  const badgeR = 20;
  ctx.save();
  ctx.shadowColor = rgba(accent, 0.9);
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = accent;
  ctx.beginPath();
  ctx.arc(avatarCX + 56, avatarCY + 56, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(opts.level), avatarCX + 56, avatarCY + 61);

  // Nombre de usuario
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(opts.username, avatarCX, avatarCY + 105, panelW - 24);

  // Rank badge
  const rankBadgeW = 90, rankBadgeH = 24;
  const rankBadgeX = avatarCX - rankBadgeW / 2;
  const rankBadgeY = avatarCY + 116;
  ctx.fillStyle   = rgba(accent, 0.2);
  roundRect(ctx, rankBadgeX, rankBadgeY, rankBadgeW, rankBadgeH, rankBadgeH / 2);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth   = 1;
  roundRect(ctx, rankBadgeX, rankBadgeY, rankBadgeW, rankBadgeH, rankBadgeH / 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font      = 'bold 12px sans-serif';
  ctx.fillText(`# ${opts.rank}`, avatarCX, rankBadgeY + 16);

  // ── Panel derecho ────────────────────────────────────────────────────────
  const px = panelW + 22;
  const pw = W - px - 22;
  ctx.textAlign = 'left';

  // Etiqueta "PERFIL DE USUARIO"
  ctx.fillStyle = rgba(accent, 0.65);
  ctx.font      = '11px sans-serif';
  ctx.fillText('PERFIL DE USUARIO', px, 28);

  // Línea separadora con gradiente
  const lineGrad = ctx.createLinearGradient(px, 0, px + pw, 0);
  lineGrad.addColorStop(0, accent);
  lineGrad.addColorStop(0.6, rgba(accent, 0.3));
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(px, 34, pw, 1);

  // XP info
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 14px sans-serif';
  ctx.fillText(`${opts.xp.toLocaleString()} / ${opts.xpNeeded.toLocaleString()} XP`, px, 58);

  const pct = Math.min(opts.xp / opts.xpNeeded, 1);
  ctx.fillStyle = rgba(accent, 0.7);
  ctx.font      = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(pct * 100)}%`, px + pw, 58);
  ctx.textAlign = 'left';

  // Barra de progreso
  drawProgressBar(ctx, px, 66, pw, 16, pct, accent);

  // Cajas de estadísticas
  const boxY = 104, boxH = 76, gap = 14;
  const boxW = (pw - gap * 2) / 3;

  // Caja Nivel
  drawGlass(ctx, px, boxY, boxW, boxH, 12, 0.07);
  ctx.fillStyle = accent;
  roundRect(ctx, px, boxY, boxW, 3, 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(opts.level), px + boxW / 2, boxY + 46, boxW - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '11px sans-serif';
  ctx.fillText('NIVEL', px + boxW / 2, boxY + 64);

  // Caja Rank
  const bx2 = px + boxW + gap;
  drawGlass(ctx, bx2, boxY, boxW, boxH, 12, 0.07);
  ctx.fillStyle = accent;
  roundRect(ctx, bx2, boxY, boxW, 3, 2); ctx.fill();
  ctx.fillStyle = accent;
  ctx.font      = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`#${opts.rank}`, bx2 + boxW / 2, boxY + 46, boxW - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '11px sans-serif';
  ctx.fillText('RANK', bx2 + boxW / 2, boxY + 64);

  // Caja XP Total
  const bx3 = px + (boxW + gap) * 2;
  drawGlass(ctx, bx3, boxY, boxW, boxH, 12, 0.07);
  ctx.fillStyle = accent;
  roundRect(ctx, bx3, boxY, boxW, 3, 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(opts.xp.toLocaleString(), bx3 + boxW / 2, boxY + 46, boxW - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '11px sans-serif';
  ctx.fillText('XP TOTAL', bx3 + boxW / 2, boxY + 64);

  // Separador
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(px, 196); ctx.lineTo(px + pw, 196); ctx.stroke();

  // Miembro desde
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font      = '12px sans-serif';
  ctx.fillText('MIEMBRO DESDE', px, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText(opts.joinedAt, px + 120, 220);

  // Roles
  if (opts.roles.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font      = '12px sans-serif';
    ctx.fillText('ROLES', px, 252);

    let roleX = px + 58;
    const maxRoles = 6;
    const shown    = opts.roles.slice(0, maxRoles);

    for (const role of shown) {
      ctx.font = '11px sans-serif';
      const rw = Math.min(ctx.measureText(role).width + 18, 140);
      if (roleX + rw > px + pw) break;

      ctx.fillStyle   = rgba(accent, 0.14);
      roundRect(ctx, roleX, 238, rw, 22, 11);
      ctx.fill();
      ctx.strokeStyle = rgba(accent, 0.4);
      ctx.lineWidth   = 1;
      roundRect(ctx, roleX, 238, rw, 22, 11);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(role, roleX + rw / 2, 253, rw - 10);
      ctx.textAlign = 'left';
      roleX += rw + 7;
    }

    if (opts.roles.length > maxRoles) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font      = '11px sans-serif';
      ctx.fillText(`+${opts.roles.length - maxRoles}`, roleX + 4, 253);
    }
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font      = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Nerea Bot', W - 12, H - 10);

  return canvas.toBuffer('image/png');
}

// ─── Tarjeta de Nivel (Rank Card) ─────────────────────────────────────────────

export async function generateRankCard(opts: RankCardOptions): Promise<Buffer> {
  const W = 880, H = 230;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const accent = opts.accentColor;
  const { r, g, b } = hexToRgb(accent);

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(1, '#16213e');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  // Círculo decorativo de fondo
  ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
  ctx.beginPath(); ctx.arc(W - 90, H / 2, 140, 0, Math.PI * 2); ctx.fill();

  drawParticles(ctx, W, H, accent, 99);

  // Borde con acento
  ctx.strokeStyle = rgba(accent, 0.28);
  ctx.lineWidth   = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 17);
  ctx.stroke();

  // Avatar
  const avatarCX = 105, avatarCY = H / 2;
  await drawCircularAvatar(ctx, opts.avatarUrl, avatarCX, avatarCY, 78, accent, 4);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(opts.username, 205, 72, 360);

  // XP
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font      = '14px sans-serif';
  ctx.fillText(`${opts.xp.toLocaleString()} / ${opts.xpNeeded.toLocaleString()} XP`, 205, 100);

  // Barra de progreso — más corta para dejar espacio a NIVEL y RANK
  const barW = W - 430;
  const pct  = Math.min(opts.xp / opts.xpNeeded, 1);
  drawProgressBar(ctx, 205, 116, barW, 22, pct, accent);

  // Porcentaje debajo de la barra
  ctx.fillStyle = rgba(accent, 0.85);
  ctx.font      = 'bold 13px sans-serif';
  ctx.fillText(`${Math.floor(pct * 100)}%`, 205, 158);

  // Separador vertical
  const sepX = W - 220;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(sepX, 35); ctx.lineTo(sepX, H - 35); ctx.stroke();

  // NIVEL (izquierda del separador)
  ctx.textAlign = 'center';
  const nivelCX = sepX + 60;
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font      = '12px sans-serif';
  ctx.fillText('NIVEL', nivelCX, 65);
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 52px sans-serif';
  ctx.fillText(String(opts.level), nivelCX, 130);

  // RANK (derecha del separador)
  const rankCX = sepX + 155;
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font      = '12px sans-serif';
  ctx.fillText('RANK', rankCX, 65);
  ctx.save();
  ctx.shadowColor = rgba(accent, 0.6);
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = accent;
  ctx.font        = 'bold 52px sans-serif';
  ctx.fillText(`#${opts.rank}`, rankCX, 130);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// ─── Tarjeta de Bienvenida ────────────────────────────────────────────────────

export async function generateWelcomeCard(opts: WelcomeCardOptions): Promise<Buffer> {
  const W = 1000, H = 420;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const accent = opts.accentColor ?? '#3498db';
  const { r, g, b } = hexToRgb(accent);

  // Fondo
  if (opts.backgroundUrl) {
    try {
      const bg = await loadImage(opts.backgroundUrl);
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, W, H);
    } catch {
      drawDefaultBg(ctx, W, H, accent);
    }
  } else {
    drawDefaultBg(ctx, W, H, accent);
  }

  // Viñeta
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Líneas decorativas
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, 'transparent');
  lineGrad.addColorStop(0.2, accent);
  lineGrad.addColorStop(0.8, accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, H - 4, W, 4);

  drawParticles(ctx, W, H, accent, 77);

  // Avatar
  const avatarCX = W / 2, avatarCY = 155;
  await drawCircularAvatar(ctx, opts.avatarUrl, avatarCX, avatarCY, 90, accent, 6);

  // Textos
  ctx.textAlign = 'center';

  ctx.save();
  ctx.shadowColor = rgba(accent, 0.8);
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = accent;
  ctx.font        = 'bold 18px sans-serif';
  ctx.fillText('BIENVENIDO/A', W / 2, avatarCY + 118);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = '#ffffff';
  ctx.font        = 'bold 46px sans-serif';
  ctx.fillText(opts.username, W / 2, avatarCY + 168, W - 80);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font      = '20px sans-serif';
  ctx.fillText(`a ${opts.guildName}`, W / 2, avatarCY + 204, W - 120);

  // Pill de miembro
  const pillW = 240, pillH = 36;
  const pillX = (W - pillW) / 2;
  const pillY = avatarCY + 222;
  ctx.fillStyle   = rgba(accent, 0.18);
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth   = 1.5;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 15px sans-serif';
  ctx.fillText(`Miembro #${opts.memberCount.toLocaleString()}`, W / 2, pillY + 24);

  return canvas.toBuffer('image/png');
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function drawDefaultBg(ctx: SKRSContext2D, w: number, h: number, accent: string): void {
  const { r, g, b } = hexToRgb(accent);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0d0d1a');
  bg.addColorStop(0.5, '#111128');
  bg.addColorStop(1, '#0a0a1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
  ctx.beginPath(); ctx.arc(w * 0.15, h * 0.2, 160, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.85, h * 0.8, 130, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${r},${g},${b},0.04)`;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 1.2, 250, 0, Math.PI * 2); ctx.fill();
}
