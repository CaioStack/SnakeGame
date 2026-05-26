/* ══════════════════════════════════════
   NEON SNAKE — Cyberpunk Edition
   Enhanced version
══════════════════════════════════════ */

/* ── Canvas & constants ── */
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;
const H      = canvas.height;
const CELL   = 20;
const COLS   = W / CELL;
const ROWS   = H / CELL;

/* ── Background canvas (matrix rain) ── */
const bgCanvas  = document.getElementById('bg-canvas');
const bgCtx     = bgCanvas.getContext('2d');
const bgColumns = [];
let   bgRaf;

function initBg() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  const cols = Math.floor(bgCanvas.width / 18);
  bgColumns.length = 0;
  for (let i = 0; i < cols; i++) {
    bgColumns.push({ y: Math.random() * bgCanvas.height, speed: 0.3 + Math.random() * 0.7 });
  }
}

function drawBg() {
  bgCtx.fillStyle = 'rgba(5,5,13,0.18)';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgCtx.font = '13px Share Tech Mono, monospace';
  bgColumns.forEach((col, i) => {
    const char = String.fromCharCode(0x30A0 + Math.random() * 96); // katakana
    const x    = i * 18;
    bgCtx.fillStyle = `rgba(0,255,204,${0.08 + Math.random() * 0.12})`;
    bgCtx.fillText(char, x, col.y);
    col.y += col.speed * 14;
    if (col.y > bgCanvas.height) col.y = -20;
  });
  bgRaf = requestAnimationFrame(drawBg);
}

window.addEventListener('resize', initBg);
initBg();
drawBg();

/* ══════════════════════════════════════
   WEB AUDIO — Synth SFX
══════════════════════════════════════ */
let audioCtx = null;
let muted    = false;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.18, detune = 0) {
  if (muted) return;
  try {
    const ac  = getAudio();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    osc.detune.setValueAtTime(detune, ac.currentTime);
    g.gain.setValueAtTime(gainVal, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (_) {}
}

function sfxEat()    { playTone(440, 'square', 0.08, 0.12); setTimeout(() => playTone(660, 'square', 0.08, 0.10), 60); }
function sfxBonus()  { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => playTone(f, 'sawtooth', 0.12, 0.10), i * 55)); }
function sfxDie()    { playTone(160, 'sawtooth', 0.35, 0.2); setTimeout(() => playTone(80, 'square', 0.5, 0.15), 120); }
function sfxLevel()  { [330, 440, 550, 880].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.15, 0.1), i * 70)); }
function sfxShield() { playTone(600, 'sine', 0.2, 0.15); setTimeout(() => playTone(900, 'sine', 0.2, 0.10), 90); }
function sfxHit()    { playTone(120, 'sawtooth', 0.18, 0.2, -200); }

document.getElementById('sound-btn').addEventListener('click', () => {
  muted = !muted;
  const btn = document.getElementById('sound-btn');
  btn.textContent = muted ? '🔇' : '🔊';
  btn.classList.toggle('muted', muted);
});

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let snake, dir, nextDir, food, particles, trail, floaters;
let score, level, best, speed, loop, running, paused, frameCount;
let combo, comboTimer, lastEatTime;
let powerup, powerupTimer, doublePoints, slowActive, shieldActive;
let lives, invincible, invincibleTimer;
let touchStartX, touchStartY;

best = parseInt(localStorage.getItem('neonSnakeBest') || '0');
document.getElementById('best').textContent = best;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
function init() {
  snake        = [{ x: 13, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 11 }];
  trail        = [];
  particles    = [];
  floaters     = [];
  dir          = { x: 1, y: 0 };
  nextDir      = { x: 1, y: 0 };
  score        = 0;
  level        = 1;
  speed        = 140;
  frameCount   = 0;
  running      = true;
  paused       = false;
  combo        = 1;
  comboTimer   = 0;
  lastEatTime  = 0;
  powerup      = null;
  powerupTimer = 0;
  doublePoints = false;
  slowActive   = false;
  shieldActive = false;
  lives        = 3;
  invincible   = false;
  invincibleTimer = 0;

  hidePowerupUI();
  updateHUD();
  spawnFood();

  clearInterval(loop);
  loop = setInterval(tick, speed);
}

/* ══════════════════════════════════════
   FOOD / POWERUPS
══════════════════════════════════════ */
function spawnFood() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));

  food       = pos;
  food.pulse = 0;

  const r = Math.random();
  if      (r < 0.08)  food.type = 'bonus';
  else if (r < 0.16)  food.type = 'slow';
  else if (r < 0.24)  food.type = 'double';
  else if (r < 0.31)  food.type = 'shield';
  else                food.type = 'normal';
}

function foodColor(type) {
  if (type === 'bonus')  return '#ff00ff';
  if (type === 'slow')   return '#00aaff';
  if (type === 'double') return '#ffaa00';
  if (type === 'shield') return '#aa44ff';
  return '#00ffcc';
}

/* ══════════════════════════════════════
   GAME TICK
══════════════════════════════════════ */
function tick() {
  if (!running || paused) return;

  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Invincibility blink counter
  if (invincible) {
    invincibleTimer--;
    if (invincibleTimer <= 0) invincible = false;
  }

  // Wall / self collision
  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);

  if (hitWall || hitSelf) {
    if (shieldActive) {
      // Shield absorbs one collision
      shieldActive = false;
      deactivatePowerupIfType('shield');
      sfxHit();
      invincible      = true;
      invincibleTimer = 18; // ~18 ticks grace
      // Bounce head back to current head
      return;
    }
    if (lives > 1) {
      lives--;
      sfxHit();
      updateHUD();
      // Respawn with grace period
      invincible      = true;
      invincibleTimer = 22;
      // Keep snake but cut it in half
      snake = snake.slice(0, Math.max(3, Math.floor(snake.length / 2)));
      return;
    }
    gameOver();
    return;
  }

  const oldTail = { ...snake[snake.length - 1] };
  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    eatFood(oldTail);
  } else {
    snake.pop();
    trail.push({ x: oldTail.x, y: oldTail.y, life: 0.35 });
  }

  food.pulse = (food.pulse || 0) + 0.15;
  frameCount++;
  draw();

  // Powerup countdown
  if (powerupTimer > 0) {
    powerupTimer -= speed;
    const total = powerup === 'slow' ? 5000 : powerup === 'shield' ? 7000 : 8000;
    const pct   = Math.max(0, powerupTimer / total * 100);
    document.getElementById('powerup-timer-bar').style.width = pct + '%';
    if (powerupTimer <= 0) deactivatePowerup();
  }
}

function eatFood(oldTail) {
  const now         = Date.now();
  const timeSinceLast = now - lastEatTime;
  lastEatTime       = now;

  // Combo
  if (lastEatTime > 0 && timeSinceLast < 3000) {
    combo = Math.min(combo + 1, 8);
  } else {
    combo = 1;
  }
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => { combo = 1; updateHUD(); }, 3000);

  // Points
  let pts = food.type === 'bonus' ? 50 : 10;
  if (doublePoints) pts *= 2;
  pts *= combo;
  score += pts;

  // Visuals + sound
  const col = foodColor(food.type);
  burst(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, col);
  addFloater(`+${pts}`, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, col);

  if (food.type === 'bonus') sfxBonus();
  else sfxEat();

  // Powerup activation
  if      (food.type === 'slow')   activatePowerup('slow');
  else if (food.type === 'double') activatePowerup('double');
  else if (food.type === 'shield') activatePowerup('shield');

  // Level up
  const newLevel = Math.floor(score / 100) + 1;
  if (newLevel > level) {
    level = newLevel;
    showLevelUp();
    sfxLevel();
    // Give a life every 5 levels
    if (level % 5 === 0 && lives < 5) { lives++; updateHUD(); }
  }

  speed = Math.max(60, 140 - (level - 1) * 10);
  if (slowActive) speed = Math.min(speed + 40, 200);

  clearInterval(loop);
  loop = setInterval(tick, speed);
  spawnFood();

  // Grow
  trail.push({ x: oldTail.x, y: oldTail.y, life: 1 });

  if (score > best) {
    best = score;
    localStorage.setItem('neonSnakeBest', best);
  }
  updateHUD();
}

/* ══════════════════════════════════════
   POWERUPS
══════════════════════════════════════ */
function activatePowerup(type) {
  // Shield stacks — just replace
  deactivatePowerup();
  powerup = type;

  if (type === 'slow') {
    slowActive   = true;
    powerupTimer = 5000;
    document.getElementById('powerup-label').textContent = '⏱ MODO LENTO';
    document.getElementById('powerup-label').style.color = '#00aaff';
    document.getElementById('powerup-timer-bar').style.background = '#00aaff';
  } else if (type === 'double') {
    doublePoints = true;
    powerupTimer = 8000;
    document.getElementById('powerup-label').textContent = '✕2 PONTOS DUPLOS';
    document.getElementById('powerup-label').style.color = '#ffaa00';
    document.getElementById('powerup-timer-bar').style.background = '#ffaa00';
  } else if (type === 'shield') {
    shieldActive = true;
    powerupTimer = 7000;
    document.getElementById('powerup-label').textContent = '🛡 ESCUDO ATIVO';
    document.getElementById('powerup-label').style.color = '#aa44ff';
    document.getElementById('powerup-timer-bar').style.background = '#aa44ff';
    sfxShield();
    showShieldFlash();
  }

  document.getElementById('powerup-timer-wrap').style.display = 'block';
}

function deactivatePowerup() {
  slowActive   = false;
  doublePoints = false;
  shieldActive = false;
  powerup      = null;
  powerupTimer = 0;
  hidePowerupUI();
}

function deactivatePowerupIfType(type) {
  if (powerup === type) deactivatePowerup();
}

function hidePowerupUI() {
  document.getElementById('powerup-label').textContent    = '';
  document.getElementById('powerup-timer-wrap').style.display = 'none';
}

/* ══════════════════════════════════════
   DRAW
══════════════════════════════════════ */
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  drawTrail();
  drawFood();
  drawFloaters();
  drawSnake();
  drawParticles();
  if (paused) drawPauseOverlay();
}

function drawGrid() {
  ctx.strokeStyle = '#ffffff05';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
  }
  for (let y = 0; y < ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
  }
  // Corner markers
  ctx.strokeStyle = '#00ffcc18';
  ctx.lineWidth   = 1;
  [[0,0],[W,0],[0,H],[W,H]].forEach(([cx,cy]) => {
    const s = 16, d = cx === 0 ? 1 : -1, dy = cy === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx + d * s, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * s);
    ctx.stroke();
  });
}

function drawTrail() {
  trail = trail.filter(t => t.life > 0);
  trail.forEach(t => {
    ctx.save();
    ctx.globalAlpha = t.life * 0.3;
    ctx.fillStyle   = '#00ffcc';
    const pad = 5;
    ctx.beginPath();
    roundRect(ctx, t.x * CELL + pad, t.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 3);
    ctx.fill();
    ctx.restore();
    t.life -= 0.065;
  });
}

function drawFood() {
  const fx  = food.x * CELL + CELL / 2;
  const fy  = food.y * CELL + CELL / 2;
  const p   = food.pulse;
  const col = foodColor(food.type);
  const r   = 6 + Math.sin(p) * 2;

  ctx.save();
  ctx.shadowBlur  = 22 + Math.sin(p) * 10;
  ctx.shadowColor = col;
  ctx.fillStyle   = col;
  ctx.beginPath();
  ctx.arc(fx, fy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur  = 0;

  // Orbiting ring for special food
  if (food.type !== 'normal') {
    const spikes = food.type === 'slow' ? 3 : food.type === 'shield' ? 6 : 4;
    ctx.strokeStyle = col + 'aa';
    ctx.lineWidth   = 1.2;
    for (let i = 0; i < spikes; i++) {
      const a = p + i * (Math.PI * 2 / spikes);
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * (r + 2), fy + Math.sin(a) * (r + 2));
      ctx.lineTo(fx + Math.cos(a) * (r + 7), fy + Math.sin(a) * (r + 7));
      ctx.stroke();
    }
    // Outer ring for shield
    if (food.type === 'shield') {
      ctx.beginPath();
      ctx.arc(fx, fy, r + 10 + Math.sin(p) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = col + '44';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSnake() {
  snake.forEach((s, i) => {
    const t   = 1 - i / snake.length;
    const x   = s.x * CELL;
    const y   = s.y * CELL;
    const pad = 1;
    const hue = (frameCount * 2 + i * 8) % 360;

    // Invincibility blink
    if (invincible && frameCount % 4 < 2 && i > 0) return;

    ctx.save();

    if (i === 0) {
      // Head color based on powerup/shield
      let headCol = '#00ffcc';
      if (shieldActive)   headCol = '#aa44ff';
      else if (powerup === 'double') headCol = '#ffaa00';
      else if (powerup === 'slow')   headCol = '#00aaff';

      ctx.shadowBlur  = shieldActive ? 28 : 18;
      ctx.shadowColor = headCol;
      ctx.fillStyle   = headCol;

      // Shield aura around head
      if (shieldActive) {
        ctx.save();
        ctx.globalAlpha = 0.25 + Math.sin(frameCount * 0.3) * 0.1;
        ctx.fillStyle   = '#aa44ff';
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.shadowBlur  = 6;
      ctx.shadowColor = `hsla(${hue},100%,65%,0.5)`;
      ctx.fillStyle   = `hsla(${hue},100%,65%,${(0.25 + t * 0.75).toFixed(2)})`;
    }

    ctx.beginPath();
    roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, Math.min(5, CELL / 3));
    ctx.fill();

    // Eyes on head
    if (i === 0) {
      const ex = dir.x, ey = dir.y;
      const e1x = x + CELL / 2 + ex * 4 + ey * 5;
      const e1y = y + CELL / 2 + ey * 4 + ex * 5;
      const e2x = x + CELL / 2 + ex * 4 - ey * 5;
      const e2y = y + CELL / 2 + ey * 4 - ex * 5;
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = '#000';
      ctx.beginPath(); ctx.arc(e1x, e1y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x, e2y, 2.5, 0, Math.PI * 2); ctx.fill();
      // White pupil highlight
      ctx.fillStyle = '#ffffff88';
      ctx.beginPath(); ctx.arc(e1x + 0.5, e1y - 0.5, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x + 0.5, e2y - 0.5, 1, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  });
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(4,4,14,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle   = '#00ffcc';
  ctx.font        = '900 22px Orbitron, monospace';
  ctx.textAlign   = 'center';
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#00ffcc';
  ctx.fillText('⏸ PAUSADO', W / 2, H / 2 - 12);
  ctx.font        = '400 10px Share Tech Mono, monospace';
  ctx.fillStyle   = '#ffffff55';
  ctx.shadowBlur  = 0;
  ctx.fillText('pressione P para continuar', W / 2, H / 2 + 16);
  ctx.restore();
}

/* ── Floating score text ── */
function addFloater(text, x, y, col) {
  floaters.push({ text, x, y, col, life: 1, vy: -1.5 });
}

function drawFloaters() {
  floaters = floaters.filter(f => f.life > 0);
  floaters.forEach(f => {
    ctx.save();
    ctx.globalAlpha = f.life;
    ctx.fillStyle   = f.col;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = f.col;
    ctx.font        = `700 13px Share Tech Mono, monospace`;
    ctx.textAlign   = 'center';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
    f.y    += f.vy;
    f.life -= 0.03;
  });
}

/* ── roundRect helper ── */
function roundRect(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
}

/* ══════════════════════════════════════
   PARTICLES
══════════════════════════════════════ */
function burst(x, y, col) {
  for (let i = 0; i < 24; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 5.5;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 1,
      col,
      r: 2 + Math.random() * 3
    });
  }
}

function drawParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.col;
    ctx.fillStyle   = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    p.x    += p.vx;
    p.y    += p.vy;
    p.life -= 0.045;
    p.vx   *= 0.91;
    p.vy   *= 0.91;
  });
}

/* ══════════════════════════════════════
   HUD / UI
══════════════════════════════════════ */
function updateHUD() {
  animHUD('score', score);
  document.getElementById('level').textContent = level;
  document.getElementById('best').textContent  = best;

  const livesStr = '❤'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
  document.getElementById('lives').textContent = livesStr;

  const comboBox = document.getElementById('combo-box');
  const comboEl  = document.getElementById('combo');
  if (combo > 1) {
    comboBox.style.display = '';
    comboEl.textContent    = 'x' + combo;
    comboEl.classList.remove('combo-val');
    void comboEl.offsetWidth;
    comboEl.classList.add('combo-val');
  } else {
    comboBox.style.display = 'none';
  }
}

let _lastScore = 0;
function animHUD(id, val) {
  const el = document.getElementById(id);
  el.textContent = val;
  if (val !== _lastScore) {
    el.closest('.hud-box').classList.remove('pulse-hud');
    void el.closest('.hud-box').offsetWidth;
    el.closest('.hud-box').classList.add('pulse-hud');
    _lastScore = val;
  }
}

function showLevelUp() {
  const el = document.getElementById('lvl-flash');
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 950);
}

function showShieldFlash() {
  const el = document.getElementById('shield-flash');
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 1000);
}

/* ══════════════════════════════════════
   GAME OVER
══════════════════════════════════════ */
function gameOver() {
  running = false;
  clearInterval(loop);
  deactivatePowerup();
  sfxDie();

  snake.forEach((s, i) => {
    setTimeout(() => {
      burst(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, '#00ffcc');
      draw();
    }, i * 22);
  });

  saveScore(score, level);

  setTimeout(() => {
    const fs = document.getElementById('final-score');
    fs.innerHTML =
      `Score: <b>${score}</b>&nbsp;&nbsp;Level: <b>${level}</b><br>` +
      `Melhor: <b>${best}</b>`;
    fs.style.display = 'block';

    const ov = document.getElementById('overlay');
    document.getElementById('overlay-title').textContent   = 'GAME OVER';
    document.getElementById('overlay-sub').textContent     = '';
    document.getElementById('start-btn').textContent       = '▶ JOGAR NOVAMENTE';
    ov.style.display = 'flex';
  }, snake.length * 22 + 400);
}

/* ══════════════════════════════════════
   HIGH SCORES
══════════════════════════════════════ */
function saveScore(s, l) {
  let scores = JSON.parse(localStorage.getItem('neonSnakeScores') || '[]');
  scores.push({ score: s, level: l, date: new Date().toLocaleDateString('pt-BR') });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 10);
  localStorage.setItem('neonSnakeScores', JSON.stringify(scores));
}

function showScores() {
  const scores = JSON.parse(localStorage.getItem('neonSnakeScores') || '[]');
  const list   = document.getElementById('scores-list');
  list.innerHTML = '';
  if (scores.length === 0) {
    list.innerHTML = '<li style="justify-content:center;color:#ffffff33;font-family:Share Tech Mono">Nenhum score ainda</li>';
  } else {
    scores.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="rank">#${i + 1}</span><span>${s.score} pts — Lv${s.level}</span><span style="color:#ffffff33;font-size:10px">${s.date}</span>`;
      list.appendChild(li);
    });
  }
  document.getElementById('overlay').style.display      = 'none';
  document.getElementById('scores-panel').style.display = 'flex';
}

/* ══════════════════════════════════════
   PAUSE
══════════════════════════════════════ */
function togglePause() {
  if (!running) return;
  paused = !paused;
  if (!paused) draw();
}

/* ══════════════════════════════════════
   KEYBOARD
══════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
  if (!running || paused) return;

  if      ((k === 'ArrowUp'    || k === 'w' || k === 'W') && dir.y !==  1) nextDir = { x:  0, y: -1 };
  else if ((k === 'ArrowDown'  || k === 's' || k === 'S') && dir.y !== -1) nextDir = { x:  0, y:  1 };
  else if ((k === 'ArrowLeft'  || k === 'a' || k === 'A') && dir.x !==  1) nextDir = { x: -1, y:  0 };
  else if ((k === 'ArrowRight' || k === 'd' || k === 'D') && dir.x !== -1) nextDir = { x:  1, y:  0 };

  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) e.preventDefault();
});

/* ══════════════════════════════════════
   MOBILE BUTTONS
══════════════════════════════════════ */
document.getElementById('mb-up').addEventListener('click',    () => { if (running && !paused && dir.y !==  1) nextDir = { x:  0, y: -1 }; });
document.getElementById('mb-down').addEventListener('click',  () => { if (running && !paused && dir.y !== -1) nextDir = { x:  0, y:  1 }; });
document.getElementById('mb-left').addEventListener('click',  () => { if (running && !paused && dir.x !==  1) nextDir = { x: -1, y:  0 }; });
document.getElementById('mb-right').addEventListener('click', () => { if (running && !paused && dir.x !== -1) nextDir = { x:  1, y:  0 }; });

/* ══════════════════════════════════════
   SWIPE (touch)
══════════════════════════════════════ */
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (!running || paused) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
    else if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
    else if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
  }
}, { passive: true });

/* ══════════════════════════════════════
   BUTTONS
══════════════════════════════════════ */
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('overlay').style.display       = 'none';
  document.getElementById('final-score').style.display  = 'none';
  document.getElementById('overlay-title').textContent  = 'NEON SNAKE';
  document.getElementById('overlay-sub').textContent    = 'CYBERPUNK EDITION';
  document.getElementById('start-btn').textContent      = '▶ INICIAR JOGO';
  // Unlock audio on first interaction
  if (!audioCtx) getAudio();
  init();
});

document.getElementById('scores-btn').addEventListener('click', showScores);

document.getElementById('scores-close-btn').addEventListener('click', () => {
  document.getElementById('scores-panel').style.display = 'none';
  if (!running) document.getElementById('overlay').style.display = 'flex';
});

/* ── Initial render ── */
draw();