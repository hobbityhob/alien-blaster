const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const modeLabelEl = document.getElementById("mode-label");
const stageEl = document.getElementById("stage");
const player1HealthEl = document.getElementById("player1-health");
const player1LivesEl = document.getElementById("player1-lives");
const player2PanelEl = document.getElementById("player2-panel");
const player2HealthEl = document.getElementById("player2-health");
const player2LivesEl = document.getElementById("player2-lives");
const bossHealthEl = document.getElementById("boss-health");
const levelProgressEl = document.getElementById("level-progress");
const progressTextEl = document.getElementById("progress-text");
const powerupStatusEl = document.getElementById("powerup-status");
const overlay = document.querySelector(".overlay-card");
const statusText = document.getElementById("status-text");
const friendlyFireButton = document.getElementById("friendly-fire-button");
const viewScoresButton = document.getElementById("view-scores-button");
const startOneButton = document.getElementById("start-one-button");
const startTwoButton = document.getElementById("start-two-button");
const scoreboardPanel = document.getElementById("scoreboard-panel");
const scoreboardList1P = document.getElementById("scoreboard-list-1p");
const scoreboardList2P = document.getElementById("scoreboard-list-2p");
const backToMenuButton = document.getElementById("back-to-menu-button");
const nameEntryPanel = document.getElementById("name-entry-panel");
const nameEntryText = document.getElementById("name-entry-text");
const winnerNameInput = document.getElementById("winner-name-input");
const submitScoreButton = document.getElementById("submit-score-button");
const skipScoreButton = document.getElementById("skip-score-button");
const overlayMenuBlocks = document.querySelectorAll(".controls, .overlay-card > .menu-actions");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const keys = new Set();
const HIGH_SCORE_STORAGE_KEY = "alien-blaster-high-scores";
const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  size: 1 + Math.random() * 2,
  speed: 20 + Math.random() * 80,
  alpha: 0.2 + Math.random() * 0.6
}));

const ROUND_CONFIG = [
  { label: "Round 1", duration: 18, spawnEvery: 1.05, alienChance: 0.55, enemySpeed: 110, fireRate: 0.008, asteroidSpeed: 140, target: 14 },
  { label: "Round 2", duration: 20, spawnEvery: 0.95, alienChance: 0.58, enemySpeed: 125, fireRate: 0.01, asteroidSpeed: 155, target: 18 },
  { label: "Round 3", duration: 22, spawnEvery: 0.84, alienChance: 0.6, enemySpeed: 145, fireRate: 0.012, asteroidSpeed: 170, target: 22 },
  { label: "Round 4", duration: 23, spawnEvery: 0.76, alienChance: 0.64, enemySpeed: 165, fireRate: 0.014, asteroidSpeed: 190, target: 26 },
  { label: "Round 5", duration: 24, spawnEvery: 0.66, alienChance: 0.68, enemySpeed: 190, fireRate: 0.016, asteroidSpeed: 215, target: 30 },
  { label: "Round 6", duration: 26, spawnEvery: 0.58, alienChance: 0.72, enemySpeed: 215, fireRate: 0.019, asteroidSpeed: 240, target: 34 }
];

const BOSS_CONFIG = {
  2: { label: "Boss 1", hp: 720, moveSpeed: 130, fireCooldown: 1.2, burstCooldown: 2.4, helperCooldown: 6.5 },
  4: { label: "Boss 2", hp: 1020, moveSpeed: 155, fireCooldown: 1, burstCooldown: 2, helperCooldown: 5.6 },
  6: { label: "Boss 3", hp: 1440, moveSpeed: 180, fireCooldown: 0.85, burstCooldown: 1.6, helperCooldown: 4.8 }
};

const PLAYER_CONFIG = [
  { label: "P1", color: "#9efee2", accent: "#f5ff88", controls: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", fire: "Space" } },
  { label: "P2", color: "#8fc2ff", accent: "#c9f2ff", controls: { left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5", fire: "ArrowRight" } }
];

let lastTime = 0;
let state = {};
let menuFriendlyFire = false;
let pendingScoreEntry = null;

function spawnHelperShip() {
  state.enemies.push({
    type: "alien",
    x: 80 + Math.random() * (WIDTH - 160),
    y: -30,
    width: 34,
    height: 28,
    hp: 26 + state.round * 8,
    speed: 145 + state.round * 14 + Math.random() * 30,
    fireRate: 0.012 + state.round * 0.0015,
    drift: (Math.random() * 2 - 1) * (24 + state.round * 4),
    phase: Math.random() * Math.PI * 2,
    value: 180
  });
}

function getKnockedOutPlayers() {
  return getPlayers().filter((player) => player.lives <= 0);
}

function needsReviveDrops() {
  return state.playerCount === 2 && getAlivePlayers().length === 1 && getKnockedOutPlayers().length === 1;
}

function createPlayer(index, playerCount) {
  const cfg = PLAYER_CONFIG[index];
  const offset = playerCount === 2 ? (index === 0 ? -110 : 110) : 0;
  return {
    id: index + 1,
    label: cfg.label,
    x: WIDTH / 2 + offset,
    y: HEIGHT - 80,
    baseOffset: offset,
    width: 34,
    height: 44,
    speed: 350,
    maxHp: 100,
    hp: 100,
    lives: 3,
    fireDelay: 0.18,
    fireTimer: 0,
    invulnerable: 0,
    laserTimer: 0,
    controls: cfg.controls,
    color: cfg.color,
    accent: cfg.accent
  };
}

function getPlayers() {
  return state.players || [];
}

function getAlivePlayers() {
  return getPlayers().filter((player) => player.lives > 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2;
}

function resetPlayerPosition(player) {
  player.x = clamp(WIDTH / 2 + player.baseOffset, player.width / 2 + 8, WIDTH - player.width / 2 - 8);
  player.y = HEIGHT - 80;
}

function showOverlay(message) {
  statusText.textContent = message;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function setOverlayMenuVisible(visible) {
  for (const block of overlayMenuBlocks) {
    block.classList.toggle("hidden-panel", !visible);
  }
}

function hideOverlayPanels() {
  scoreboardPanel.classList.add("hidden-panel");
  nameEntryPanel.classList.add("hidden-panel");
}

function showMainMenu(message = "Choose solo or co-op, then blast through six rounds of alien ships and asteroid storms. Boss fights unlock after rounds 2, 4, and 6.") {
  pendingScoreEntry = null;
  showOverlay(message);
  setOverlayMenuVisible(true);
  hideOverlayPanels();
}

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHighScores(scores) {
  localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(scores));
}

function qualifiesForHighScore(mode, score) {
  const modeScores = loadHighScores()
    .filter((entry) => entry.mode === mode)
    .sort((a, b) => b.score - a.score);

  if (modeScores.length < 20) {
    return true;
  }

  return score > modeScores[modeScores.length - 1].score;
}

function formatScoreMode(entry) {
  return `${entry.mode}${entry.friendlyFire ? " FF" : ""}`;
}

function formatScoreDate(recordedAt) {
  if (!recordedAt) {
    return "Unknown date";
  }
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString();
}

function renderScoreList(listEl, scores) {
  listEl.innerHTML = "";
  if (!scores.length) {
    const item = document.createElement("li");
    item.textContent = "No high scores yet.";
    listEl.appendChild(item);
    return;
  }

  scores.slice(0, 20).forEach((entry, index) => {
    const roundText = entry.roundReached ? `Round ${entry.roundReached}` : "Round ?";
    const modeText = formatScoreMode(entry);
    const item = document.createElement("li");
    item.innerHTML = `<span><span class="score-main">${index + 1}. ${entry.name}</span><span class="score-meta">${roundText} • ${formatScoreDate(entry.recordedAt)} • ${modeText}</span></span><span>${entry.score}</span>`;
    listEl.appendChild(item);
  });
}

function renderHighScores() {
  const scores = loadHighScores();
  renderScoreList(scoreboardList1P, scores.filter((entry) => entry.mode === "1P"));
  renderScoreList(scoreboardList2P, scores.filter((entry) => entry.mode === "2P"));
}

function showHighScores() {
  showOverlay("Top 20 scores recorded on this device.");
  setOverlayMenuVisible(false);
  hideOverlayPanels();
  renderHighScores();
  scoreboardPanel.classList.remove("hidden-panel");
}

function promptHighScoreEntry(scoreEntry) {
  pendingScoreEntry = scoreEntry;
  showOverlay(`Victory. Final score: ${scoreEntry.score}. Record your name for the top 20.`);
  setOverlayMenuVisible(false);
  hideOverlayPanels();
  nameEntryText.textContent = `Enter a pilot or team name for ${scoreEntry.mode}.`;
  winnerNameInput.value = "";
  nameEntryPanel.classList.remove("hidden-panel");
  winnerNameInput.focus();
}

function submitHighScore() {
  if (!pendingScoreEntry) {
    showMainMenu();
    return;
  }

  const scores = loadHighScores();
  scores.push({
    name: (winnerNameInput.value.trim() || "ANON").slice(0, 18),
    score: pendingScoreEntry.score,
    mode: pendingScoreEntry.mode,
    friendlyFire: pendingScoreEntry.friendlyFire,
    roundReached: pendingScoreEntry.roundReached,
    recordedAt: new Date().toISOString()
  });
  scores.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  saveHighScores(scores.slice(0, 20));
  pendingScoreEntry = null;
  showHighScores();
}

function resetGame(playerCount = 1) {
  state = {
    mode: "title",
    playerCount,
    friendlyFire: menuFriendlyFire,
    score: 0,
    round: 1,
    roundKills: 0,
    elapsedInRound: 0,
    spawnTimer: 0,
    enemies: [],
    powerUps: [],
    playerBullets: [],
    enemyBullets: [],
    explosions: [],
    shockwaves: [],
    transition: null,
    boss: null,
    reviveProgress: 0,
    reviveSpawnTimer: 0,
    players: Array.from({ length: playerCount }, (_, index) => createPlayer(index, playerCount)),
    pause: false,
    flashTimer: 0,
    message: ""
  };
  updateHud();
  showMainMenu();
}

function startGame(playerCount) {
  resetGame(playerCount);
  state.mode = "playing";
  hideOverlay();
  loadRound(1);
}

function loadRound(round) {
  state.round = round;
  state.roundKills = 0;
  state.elapsedInRound = 0;
  state.spawnTimer = 0;
  state.enemies = [];
  state.powerUps = [];
  state.enemyBullets = [];
  state.playerBullets = [];
  state.shockwaves = [];
  state.boss = null;
  state.reviveSpawnTimer = 0;
  state.mode = "playing";
  state.message = ROUND_CONFIG[round - 1].label;
  state.flashTimer = 1.5;
  for (const player of getAlivePlayers()) {
    resetPlayerPosition(player);
    player.invulnerable = 1;
  }
  updateHud();
}

function loadBoss(round) {
  const cfg = BOSS_CONFIG[round];
  state.mode = "boss";
  state.enemies = [];
  state.powerUps = [];
  state.enemyBullets = [];
  state.playerBullets = [];
  state.shockwaves = [];
  state.boss = {
    x: WIDTH / 2,
    y: 96,
    width: 180,
    height: 84,
    vx: cfg.moveSpeed,
    maxHp: cfg.hp,
    hp: cfg.hp,
    fireTimer: cfg.fireCooldown,
    fireCooldown: cfg.fireCooldown,
    burstTimer: cfg.burstCooldown,
    burstCooldown: cfg.burstCooldown,
    helperTimer: cfg.helperCooldown,
    helperCooldown: cfg.helperCooldown
  };
  for (const player of getAlivePlayers()) {
    resetPlayerPosition(player);
    player.invulnerable = 1;
  }
  state.message = `${cfg.label}: Eliminate the command ship`;
  state.flashTimer = 1.7;
  updateHud();
}

function updateHud() {
  const [player1, player2] = getPlayers();
  scoreEl.textContent = state.score;
  modeLabelEl.textContent = state.playerCount === 2 ? "2 Player" : "1 Player";
  stageEl.textContent = state.mode === "boss" ? BOSS_CONFIG[state.round].label : `Round ${state.round}`;
  player2PanelEl.classList.toggle("hidden-panel", state.playerCount !== 2);
  if (player1) {
    player1HealthEl.style.width = `${Math.max(0, player1.hp / player1.maxHp) * 100}%`;
    player1LivesEl.textContent = `${Math.max(0, player1.lives)} lives`;
  }
  if (player2) {
    player2HealthEl.style.width = `${Math.max(0, player2.hp / player2.maxHp) * 100}%`;
    player2LivesEl.textContent = `${Math.max(0, player2.lives)} lives`;
  }
  bossHealthEl.style.width = state.boss ? `${Math.max(0, state.boss.hp / state.boss.maxHp) * 100}%` : "0%";
  if (state.mode === "boss" && state.boss) {
    const progress = 1 - Math.max(0, state.boss.hp / state.boss.maxHp);
    levelProgressEl.style.width = `${progress * 100}%`;
    progressTextEl.textContent = `Boss damage ${Math.round(progress * 100)}%`;
  } else {
    const cfg = ROUND_CONFIG[state.round - 1];
    const progress = Math.min(1, state.roundKills / cfg.target);
    levelProgressEl.style.width = `${progress * 100}%`;
    progressTextEl.textContent = `${Math.min(state.roundKills, cfg.target)} / ${cfg.target} targets cleared`;
  }
  const powerText = getAlivePlayers().map((player) => {
    const active = [];
    if (player.laserTimer > 0) {
      active.push(`Laser ${player.laserTimer.toFixed(1)}s`);
    }
    return `${player.label}: ${active.join(", ") || "None"}`;
  }).join(" | ");
  const reviveText = needsReviveDrops() ? `Revive ${state.reviveProgress}/3` : "Revive --";
  powerupStatusEl.textContent = `${powerText || "No players active"} | ${reviveText} | FF: ${state.friendlyFire ? "On" : "Off"}`;
}

function spawnEnemy() {
  const cfg = ROUND_CONFIG[state.round - 1];
  if (Math.random() < cfg.alienChance) {
    state.enemies.push({
      type: "alien",
      x: 60 + Math.random() * (WIDTH - 120),
      y: -30,
      width: 34,
      height: 28,
      hp: 18 + state.round * 6,
      speed: cfg.enemySpeed + Math.random() * 30,
      fireRate: cfg.fireRate,
      drift: (Math.random() * 2 - 1) * (18 + state.round * 3),
      phase: Math.random() * Math.PI * 2,
      value: 140
    });
  } else {
    const size = 24 + Math.random() * 28;
    state.enemies.push({
      type: "asteroid",
      x: 50 + Math.random() * (WIDTH - 100),
      y: -size,
      width: size,
      height: size,
      hp: 16 + state.round * 8,
      speed: cfg.asteroidSpeed + Math.random() * 35,
      spin: (Math.random() * 2 - 1) * 4,
      angle: Math.random() * Math.PI * 2,
      drift: (Math.random() * 2 - 1) * 22,
      value: 90
    });
  }
}

function maybeSpawnPowerUp(x, y) {
  if (needsReviveDrops() && Math.random() < 0.08) {
    state.powerUps.push({ type: "revive", x, y, width: 24, height: 24, speed: 120 });
    return;
  }
  const roundFactor = state.round - 1;
  const novaChance = 0.02 + roundFactor * 0.002;
  const laserChance = 0.08 + roundFactor * 0.012;
  const healthChance = 0.1 + roundFactor * 0.028;
  const roll = Math.random();
  let type = null;
  if (roll < novaChance) {
    type = "nova";
  } else if (roll < novaChance + laserChance) {
    type = "laser";
  } else if (roll < novaChance + laserChance + healthChance) {
    type = "health";
  }
  if (!type) {
    return;
  }
  state.powerUps.push({ type, x, y, width: 24, height: 24, speed: 120 });
}

function firePlayerBullet(player) {
  if (player.fireTimer > 0 || player.lives <= 0) {
    return;
  }
  player.fireTimer = player.fireDelay;
  state.playerBullets.push(
    { x: player.x, y: player.y - player.height / 2 - 8, width: 6, height: 18, speed: 520, damage: 12, color: player.color, ownerId: player.id },
    { x: player.x - 12, y: player.y - player.height / 2 - 4, width: 4, height: 14, speed: 500, damage: 8, color: player.color, ownerId: player.id },
    { x: player.x + 12, y: player.y - player.height / 2 - 4, width: 4, height: 14, speed: 500, damage: 8, color: player.color, ownerId: player.id }
  );
}

function fireEnemyBullet(x, y, angle, speed, width = 8, height = 16, damage = 14) {
  state.enemyBullets.push({ x, y, width, height, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage });
}

function endGame(mode) {
  state.mode = mode;
  updateHud();
  const scoreEntry = {
    score: state.score,
    mode: state.playerCount === 2 ? "2P" : "1P",
    friendlyFire: state.friendlyFire,
    roundReached: state.round
  };

  if (mode === "victory") {
    promptHighScoreEntry({ ...scoreEntry, roundReached: 6 });
  } else {
    if (qualifiesForHighScore(scoreEntry.mode, scoreEntry.score)) {
      promptHighScoreEntry(scoreEntry);
      statusText.textContent = `Campaign failed, but score ${scoreEntry.score} qualifies for the ${scoreEntry.mode} board. Record your name.`;
    } else {
      showMainMenu(`Mission failed. Final score: ${state.score}. Choose a mode to restart.`);
    }
  }
}

function damagePlayer(player, amount) {
  if (player.invulnerable > 0 || player.lives <= 0) {
    return;
  }
  player.hp -= amount;
  player.invulnerable = 1.4;
  state.flashTimer = 0.35;
  if (player.hp <= 0) {
    player.lives -= 1;
    if (state.playerCount === 2) {
      state.reviveProgress = 0;
    }
    state.explosions.push({ x: player.x, y: player.y, radius: 18, life: 0.6, maxLife: 0.6, color: "#ffb366" });
    if (player.lives <= 0) {
      player.hp = 0;
      player.laserTimer = 0;
      if (getAlivePlayers().length === 0) {
        endGame("gameover");
        return;
      }
    } else {
      player.hp = player.maxHp;
      player.laserTimer = 0;
      resetPlayerPosition(player);
      state.enemyBullets = [];
    }
  }
  updateHud();
}

function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    state.score += enemy.value;
    state.roundKills += 1;
    maybeSpawnPowerUp(enemy.x, enemy.y);
    state.explosions.push({
      x: enemy.x,
      y: enemy.y,
      radius: enemy.type === "asteroid" ? enemy.width * 0.55 : 22,
      life: 0.45,
      maxLife: 0.45,
      color: enemy.type === "asteroid" ? "#ffd17c" : "#7effcb"
    });
    return true;
  }
  return false;
}

function damageBoss(amount) {
  if (!state.boss) {
    return;
  }
  state.boss.hp -= amount;
  state.score += 8;
  if (state.boss.hp <= 0) {
    const bossX = state.boss.x;
    const bossY = state.boss.y;
    const defeatedRound = state.round;
    const wasFinalBoss = state.round === 6;
    state.score += 1200 + state.round * 250;
    createBossExplosionSequence(bossX, bossY);
    state.enemyBullets = [];
    state.enemies = [];
    state.powerUps = [];
    state.boss = null;
    state.mode = "boss-defeated";
    state.transition = {
      timer: 2.6,
      next: wasFinalBoss ? "victory" : "round",
      round: defeatedRound + 1
    };
    state.message = "Boss destroyed";
    state.flashTimer = 1.8;
  }
  updateHud();
}

function createBossExplosionSequence(x, y) {
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    const distance = 10 + Math.random() * 86;
    const life = 1 + Math.random() * 0.7;
    state.explosions.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      radius: 28 + Math.random() * 38,
      life,
      maxLife: life,
      color: i % 3 === 0 ? "#ffe27a" : i % 2 === 0 ? "#ff6e8d" : "#ff9b58",
      delay: i * 0.06
    });
  }
  state.shockwaves.push({ x, y, radius: 30, maxRadius: 260, life: 1, maxLife: 1 });
  state.shockwaves.push({ x, y, radius: 10, maxRadius: 340, life: 1.3, maxLife: 1.3 });
}

function activateNovaBlast(player) {
  state.shockwaves.push({ x: player.x, y: player.y, radius: 10, maxRadius: 430, life: 0.75, maxLife: 0.75 });
  for (const enemy of state.enemies) {
    enemy.hp = 0;
    state.score += enemy.value;
    state.roundKills += 1;
    state.explosions.push({
      x: enemy.x,
      y: enemy.y,
      radius: enemy.type === "asteroid" ? enemy.width * 0.72 : 28,
      life: 0.55,
      maxLife: 0.55,
      color: "#ff8d76"
    });
  }
  state.enemies = [];
  state.enemyBullets = [];
  if (state.boss) {
    damageBoss(55);
  }
  state.message = `${player.label} unleashed a nova blast`;
  state.flashTimer = 1.2;
  updateHud();
}

function collectPowerUp(powerUp, player) {
  if (powerUp.type === "laser") {
    player.laserTimer = Math.max(player.laserTimer, 6);
    state.message = `${player.label} laser beam online`;
  } else if (powerUp.type === "health") {
    player.hp = Math.min(player.maxHp, player.hp + 35);
    state.message = `${player.label} hull restored`;
  } else if (powerUp.type === "revive") {
    state.reviveProgress += 1;
    state.message = `${player.label} recovered a revive shard`;
    if (state.reviveProgress >= 3) {
      const knockedOut = getKnockedOutPlayers()[0];
      if (knockedOut) {
        knockedOut.lives = 1;
        knockedOut.hp = knockedOut.maxHp;
        knockedOut.invulnerable = 2;
        knockedOut.laserTimer = 0;
        resetPlayerPosition(knockedOut);
        state.message = `${knockedOut.label} is back in the fight`;
      }
      state.reviveProgress = 0;
    }
  } else {
    activateNovaBlast(player);
  }
  state.score += 125;
  state.flashTimer = 1.1;
  updateHud();
}

function chooseTarget(x, y) {
  const alivePlayers = getAlivePlayers();
  if (!alivePlayers.length) {
    return null;
  }
  return alivePlayers.reduce((best, player) => {
    const bestDistance = Math.hypot(best.x - x, best.y - y);
    const distance = Math.hypot(player.x - x, player.y - y);
    return distance < bestDistance ? player : best;
  });
}

function handleRoundAdvance() {
  const cfg = ROUND_CONFIG[state.round - 1];
  const targetReached = state.roundKills >= cfg.target;
  const timeExpired = state.elapsedInRound >= cfg.duration;
  if ((targetReached || timeExpired) && state.enemies.length === 0 && state.enemyBullets.length === 0 && state.powerUps.length === 0) {
    if (BOSS_CONFIG[state.round]) {
      loadBoss(state.round);
    } else {
      loadRound(state.round + 1);
    }
  }
}

function updatePlayers(dt) {
  for (const player of getAlivePlayers()) {
    let moveX = 0;
    let moveY = 0;
    if (keys.has(player.controls.left)) {
      moveX -= 1;
    }
    if (keys.has(player.controls.right)) {
      moveX += 1;
    }
    if (keys.has(player.controls.up)) {
      moveY -= 1;
    }
    if (keys.has(player.controls.down)) {
      moveY += 1;
    }
    if (moveX || moveY) {
      const length = Math.hypot(moveX, moveY) || 1;
      player.x += (moveX / length) * player.speed * dt;
      player.y += (moveY / length) * player.speed * dt;
    }
    player.x = clamp(player.x, player.width / 2 + 8, WIDTH - player.width / 2 - 8);
    player.y = clamp(player.y, player.height / 2 + 12, HEIGHT - player.height / 2 - 10);
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (keys.has(player.controls.fire) && player.laserTimer <= 0) {
      firePlayerBullet(player);
    }
  }
}

function updateBullets(dt) {
  for (const bullet of state.playerBullets) {
    bullet.y -= bullet.speed * dt;
  }
  state.playerBullets = state.playerBullets.filter((bullet) => bullet.y + bullet.height > 0);
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.enemyBullets = state.enemyBullets.filter((bullet) =>
    bullet.y - bullet.height < HEIGHT + 20 &&
    bullet.y + bullet.height > -20 &&
    bullet.x + bullet.width > -20 &&
    bullet.x - bullet.width < WIDTH + 20
  );
}

function updatePowerUps(dt) {
  for (const powerUp of state.powerUps) {
    powerUp.y += powerUp.speed * dt;
  }
  state.powerUps = state.powerUps.filter((powerUp) => powerUp.y - powerUp.height / 2 < HEIGHT + 20);
  if (needsReviveDrops()) {
    state.reviveSpawnTimer += dt;
    if (state.reviveSpawnTimer >= 8.5) {
      state.reviveSpawnTimer = 0;
      state.powerUps.push({
        type: "revive",
        x: 100 + Math.random() * (WIDTH - 200),
        y: -20,
        width: 24,
        height: 24,
        speed: 135
      });
    }
  } else {
    state.reviveSpawnTimer = 0;
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    if (enemy.type === "alien") {
      enemy.y += enemy.speed * dt;
      enemy.phase += dt * 2.5;
      enemy.x += Math.sin(enemy.phase) * enemy.drift * dt;
      enemy.x = clamp(enemy.x, enemy.width / 2 + 6, WIDTH - enemy.width / 2 - 6);
      if (Math.random() < enemy.fireRate) {
        const target = chooseTarget(enemy.x, enemy.y);
        if (target) {
          const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
          fireEnemyBullet(enemy.x, enemy.y + 16, angle, 230 + state.round * 18, 8, 16, 16);
        }
      }
    } else {
      enemy.y += enemy.speed * dt;
      enemy.x += enemy.drift * dt;
      enemy.angle += enemy.spin * dt;
      if (enemy.x < 24 || enemy.x > WIDTH - 24) {
        enemy.drift *= -1;
      }
    }
    if (enemy.y - enemy.height / 2 > HEIGHT + 40) {
      enemy.hp = 0;
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function updateBoss(dt) {
  if (!state.boss) {
    return;
  }
  const boss = state.boss;
  boss.x += boss.vx * dt;
  if (boss.x < boss.width / 2 + 20 || boss.x > WIDTH - boss.width / 2 - 20) {
    boss.vx *= -1;
  }
  boss.fireTimer -= dt;
  boss.burstTimer -= dt;
  boss.helperTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = boss.fireCooldown;
    const target = chooseTarget(boss.x, boss.y);
    if (target) {
      for (const offset of [-34, 0, 34]) {
        const angle = Math.atan2(target.y - boss.y, target.x - (boss.x + offset));
        fireEnemyBullet(boss.x + offset, boss.y + boss.height / 2 - 8, angle, 260 + state.round * 22, 10, 20, 18);
      }
    }
  }
  if (boss.burstTimer <= 0) {
    boss.burstTimer = boss.burstCooldown;
    const waves = state.round === 6 ? 10 : state.round === 4 ? 8 : 6;
    for (let i = 0; i < waves; i += 1) {
      const angle = Math.PI * 0.2 + (i / (waves - 1)) * (Math.PI * 0.6);
      fireEnemyBullet(boss.x, boss.y + 8, angle, 190 + state.round * 12, 12, 22, 20);
    }
  }
  if (boss.helperTimer <= 0) {
    boss.helperTimer = boss.helperCooldown;
    if (state.enemies.length < 5) {
      spawnHelperShip();
      if (state.round >= 4 && state.enemies.length < 4) {
        spawnHelperShip();
      }
    }
    state.message = `${BOSS_CONFIG[state.round].label} deployed helpers`;
    state.flashTimer = 0.9;
  }
}

function updateLaser(dt) {
  for (const player of getAlivePlayers()) {
    if (player.laserTimer <= 0) {
      continue;
    }
    player.laserTimer = Math.max(0, player.laserTimer - dt);
    if (!keys.has(player.controls.fire)) {
      continue;
    }
    const beamWidth = 54;
    const beamBottom = player.y - player.height / 2;
    for (const enemy of state.enemies) {
      const overlapsX = Math.abs(enemy.x - player.x) < enemy.width / 2 + beamWidth / 2;
      const abovePlayer = enemy.y + enemy.height / 2 >= 0 && enemy.y - enemy.height / 2 <= beamBottom;
      if (overlapsX && abovePlayer) {
        damageEnemy(enemy, 180 * dt);
      }
    }
    if (state.boss && Math.abs(state.boss.x - player.x) < state.boss.width / 2 + beamWidth / 2) {
      damageBoss(90 * dt);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function handleCollisions() {
  state.playerBullets = state.playerBullets.filter((bullet) => {
    for (const enemy of state.enemies) {
      if (rectsOverlap(bullet, enemy)) {
        damageEnemy(enemy, bullet.damage);
        return false;
      }
    }
    for (const player of getAlivePlayers()) {
      if (state.friendlyFire && player.id !== bullet.ownerId && rectsOverlap(bullet, player)) {
        damagePlayer(player, bullet.damage);
        return false;
      }
    }
    if (state.boss && rectsOverlap(bullet, state.boss)) {
      damageBoss(bullet.damage);
      return false;
    }
    return true;
  });
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    for (const player of getAlivePlayers()) {
      if (rectsOverlap(bullet, player)) {
        damagePlayer(player, bullet.damage);
        return false;
      }
    }
    return true;
  });
  state.powerUps = state.powerUps.filter((powerUp) => {
    for (const player of getAlivePlayers()) {
      if (rectsOverlap(powerUp, player)) {
        collectPowerUp(powerUp, player);
        return false;
      }
    }
    return true;
  });
  for (const enemy of state.enemies) {
    for (const player of getAlivePlayers()) {
      if (rectsOverlap(enemy, player)) {
        damagePlayer(player, enemy.type === "asteroid" ? 28 : 20);
        enemy.hp = 0;
        state.explosions.push({ x: enemy.x, y: enemy.y, radius: enemy.type === "asteroid" ? enemy.width * 0.6 : 24, life: 0.35, maxLife: 0.35, color: "#ffd17c" });
      }
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const alivePlayers = getAlivePlayers();
  if (state.friendlyFire && alivePlayers.length === 2 && rectsOverlap(alivePlayers[0], alivePlayers[1])) {
    damagePlayer(alivePlayers[0], 10);
    damagePlayer(alivePlayers[1], 10);
  }
  if (state.boss) {
    for (const player of getAlivePlayers()) {
      if (rectsOverlap(state.boss, player)) {
        damagePlayer(player, 40);
      }
    }
  }
}

function updateExplosions(dt) {
  for (const explosion of state.explosions) {
    if (explosion.delay && explosion.delay > 0) {
      explosion.delay -= dt;
      continue;
    }
    explosion.life -= dt;
  }
  state.explosions = state.explosions.filter((explosion) => (explosion.delay && explosion.delay > 0) || explosion.life > 0);
}

function updateShockwaves(dt) {
  for (const wave of state.shockwaves) {
    wave.life -= dt;
    wave.radius += ((wave.maxRadius - wave.radius) * 5) * dt;
  }
  state.shockwaves = state.shockwaves.filter((wave) => wave.life > 0);
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > HEIGHT) {
      star.y = -4;
      star.x = Math.random() * WIDTH;
    }
  }
}

function hexToRgba(hex, alpha) {
  const parts = (hex.replace("#", "").match(/.{1,2}/g) || ["ff", "ff", "ff"]).map((part) => parseInt(part, 16));
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#09131f");
  bg.addColorStop(0.55, "#07111f");
  bg.addColorStop(1, "#03070f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of stars) {
    ctx.fillStyle = `rgba(196, 233, 255, ${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.strokeStyle = "rgba(62, 145, 196, 0.09)";
  ctx.lineWidth = 1;
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawPlayer(player) {
  const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
  if (flicker || player.lives <= 0) {
    return;
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(14, 14);
  ctx.lineTo(5, 10);
  ctx.lineTo(0, 20);
  ctx.lineTo(-5, 10);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = player.accent;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(4, 6);
  ctx.lineTo(0, 11);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff8e58";
  ctx.beginPath();
  ctx.moveTo(-7, 19);
  ctx.lineTo(0, 34 + Math.random() * 7);
  ctx.lineTo(7, 19);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPowerUps() {
  const labels = { laser: "L", nova: "N", health: "+", revive: "R" };
  for (const powerUp of state.powerUps) {
    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);
    if (powerUp.type === "revive") {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#58a9ff";
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = "#c6e5ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = "#e9f5ff";
      ctx.font = '700 13px "Orbitron", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[powerUp.type], 0, 1);
    } else {
      ctx.fillStyle = powerUp.type === "health" ? "#38d96b" : "#ffe15a";
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeStyle = powerUp.type === "health" ? "#c2ffd0" : "#fff3a6";
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -12, 24, 24);
      ctx.fillStyle = powerUp.type === "health" ? "#f2fff5" : "#5a4100";
      ctx.font = '700 14px "Orbitron", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[powerUp.type], 0, 1);
    }
    ctx.restore();
  }
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.type === "alien") {
    ctx.fillStyle = "#fd789d";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(16, -2);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.lineTo(-16, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe36a";
    ctx.fillRect(-6, -4, 12, 6);
  } else {
    ctx.rotate(enemy.angle);
    ctx.fillStyle = "#a8927f";
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = enemy.width * 0.35 + (i % 2 === 0 ? 6 : 0);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 230, 180, 0.22)";
    ctx.beginPath();
    ctx.arc(-4, -2, enemy.width * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoss() {
  if (!state.boss) {
    return;
  }
  ctx.save();
  ctx.translate(state.boss.x, state.boss.y);
  ctx.fillStyle = "#ff618b";
  ctx.beginPath();
  ctx.moveTo(-80, -10);
  ctx.lineTo(-36, -40);
  ctx.lineTo(36, -40);
  ctx.lineTo(80, -10);
  ctx.lineTo(66, 36);
  ctx.lineTo(-66, 36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd35a";
  ctx.fillRect(-18, -10, 36, 18);
  ctx.fillStyle = "#ffe9a6";
  ctx.fillRect(-56, 6, 18, 8);
  ctx.fillRect(38, 6, 18, 8);
  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.playerBullets) {
    ctx.fillStyle = bullet.color;
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
  }
  for (const bullet of state.enemyBullets) {
    ctx.fillStyle = "#ff9a66";
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
  }
}

function drawLaser() {
  for (const player of getAlivePlayers()) {
    if (player.laserTimer <= 0 || !keys.has(player.controls.fire)) {
      continue;
    }
    const beamWidth = 26 + Math.sin(performance.now() * 0.02) * 4;
    const bottom = player.y - player.height / 2;
    const gradient = ctx.createLinearGradient(player.x, bottom, player.x, 0);
    gradient.addColorStop(0, "rgba(255, 170, 228, 0.2)");
    gradient.addColorStop(0.25, "rgba(255, 145, 218, 0.95)");
    gradient.addColorStop(1, "rgba(255, 242, 186, 0.85)");
    ctx.fillStyle = gradient;
    ctx.fillRect(player.x - beamWidth / 2, 0, beamWidth, bottom);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(player.x - 4, 0, 8, bottom);
  }
}

function drawShockwaves() {
  for (const wave of state.shockwaves) {
    const alpha = wave.life / wave.maxLife;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 102, 80, ${alpha * 0.75})`;
    ctx.lineWidth = 14 * alpha + 2;
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 196, 150, ${alpha * 0.45})`;
    ctx.lineWidth = 6 * alpha + 1;
    ctx.arc(wave.x, wave.y, wave.radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawExplosions() {
  for (const explosion of state.explosions) {
    if (explosion.delay && explosion.delay > 0) {
      continue;
    }
    const ratio = explosion.life / explosion.maxLife;
    ctx.beginPath();
    ctx.fillStyle = hexToRgba(explosion.color, ratio * 0.45);
    ctx.arc(explosion.x, explosion.y, explosion.radius * (1.3 - ratio * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMessage() {
  if (state.flashTimer <= 0 || !state.message) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.flashTimer);
  ctx.fillStyle = "rgba(8, 15, 29, 0.5)";
  ctx.fillRect(220, 22, 520, 48);
  ctx.strokeStyle = "rgba(139, 255, 159, 0.3)";
  ctx.strokeRect(220, 22, 520, 48);
  ctx.fillStyle = "#f4ff94";
  ctx.font = '700 22px "Orbitron", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(state.message, WIDTH / 2, 53);
  ctx.restore();
}

function drawPausedLabel() {
  if (!state.pause) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 18, 0.72)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef7ff";
  ctx.font = '700 34px "Orbitron", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Paused", WIDTH / 2, HEIGHT / 2);
  ctx.font = '600 18px "Rajdhani", sans-serif';
  ctx.fillStyle = "#9eb9c8";
  ctx.fillText("Press P to resume", WIDTH / 2, HEIGHT / 2 + 32);
  ctx.restore();
}

function render() {
  drawBackground();
  drawShockwaves();
  drawLaser();
  drawBullets();
  drawPowerUps();
  for (const enemy of state.enemies) {
    drawEnemy(enemy);
  }
  drawBoss();
  for (const player of getPlayers()) {
    drawPlayer(player);
  }
  drawExplosions();
  drawMessage();
  drawPausedLabel();
}

function update(dt) {
  updateStars(dt);
  if (state.pause) {
    render();
    return;
  }
  if (!["playing", "boss", "boss-defeated"].includes(state.mode)) {
    render();
    return;
  }
  if (["playing", "boss"].includes(state.mode)) {
    updatePlayers(dt);
    updateBullets(dt);
    updatePowerUps(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateLaser(dt);
    handleCollisions();
  }
  updateShockwaves(dt);
  updateExplosions(dt);
  if (state.mode === "playing") {
    const cfg = ROUND_CONFIG[state.round - 1];
    state.elapsedInRound += dt;
    state.spawnTimer += dt;
    if (state.spawnTimer >= cfg.spawnEvery && state.roundKills + state.enemies.length < cfg.target + 4) {
      state.spawnTimer = 0;
      spawnEnemy();
    }
    handleRoundAdvance();
  } else if (state.mode === "boss-defeated" && state.transition) {
    state.transition.timer -= dt;
    if (state.transition.timer <= 0) {
      if (state.transition.next === "victory") {
        state.transition = null;
        endGame("victory");
      } else {
        const nextRound = state.transition.round;
        state.transition = null;
        loadRound(nextRound);
      }
    }
  }
  state.flashTimer = Math.max(0, state.flashTimer - dt);
  updateHud();
  render();
}

function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;
  update(dt);
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["Space", "Numpad8", "Numpad4", "Numpad5", "Numpad6", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  const overlayPanelOpen = !scoreboardPanel.classList.contains("hidden-panel") || !nameEntryPanel.classList.contains("hidden-panel");
  if (event.code === "Enter" && ["title", "gameover", "victory"].includes(state.mode) && !overlayPanelOpen) {
    startGame(state.playerCount || 1);
  }
  if (event.code === "KeyP" && ["playing", "boss"].includes(state.mode)) {
    state.pause = !state.pause;
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

startOneButton.addEventListener("click", () => startGame(1));
startTwoButton.addEventListener("click", () => startGame(2));
viewScoresButton.addEventListener("click", () => showHighScores());
backToMenuButton.addEventListener("click", () => showMainMenu());
friendlyFireButton.addEventListener("click", () => {
  menuFriendlyFire = !menuFriendlyFire;
  friendlyFireButton.textContent = `Friendly Fire: ${menuFriendlyFire ? "On" : "Off"}`;
  if (state.mode === "title") {
    updateHud();
  }
});
submitScoreButton.addEventListener("click", () => submitHighScore());
skipScoreButton.addEventListener("click", () => {
  pendingScoreEntry = null;
  showMainMenu("Victory recorded skipped. Choose a mode to play again.");
});
winnerNameInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    submitHighScore();
  }
});

resetGame(1);
requestAnimationFrame(gameLoop);
