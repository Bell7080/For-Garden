const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SPRITE_SHEET = 'char_run_001.png';
const USE_FULL_GRID = true;
const GRID_COLS = 8;
const GRID_ROWS = 2;

const MANUAL_FRAME_W = 190;
const MANUAL_FRAME_H = 210;
const MANUAL_START_X = 58;
const MANUAL_START_Y = 292;
const MANUAL_GAP_X = 58;
const MANUAL_GAP_Y = 204;

// 요구사항: 정지 = 1(16)번, 이동 = 2~15 반복
const IDLE_FRAME = 15; // 16번
const RUN_SEQUENCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2~15번

const keys = { a: false, d: false, space: false };

const world = {
  gravity: 1500,
  scrollX: 0,
  groundY: 0,
  tileW: 320,
  tileH: 26,
};

const player = {
  x: 0,
  y: 0,
  targetW: 160,
  targetH: 220,
  vx: 0,
  vy: 0,
  speed: 340,
  jumpPower: 700,
  facing: 1,
  onGround: true,
  runIdx: 0,
  frameTimer: 0,
  frameInterval: 0.07,
};

const sprite = new Image();
sprite.src = SPRITE_SHEET;

let frameW = 256;
let frameH = 384;
let footOffsets = new Map();
let baselineFoot = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  world.groundY = Math.floor(canvas.height * 0.8);
  player.x = canvas.width * 0.5;
  if (player.onGround) player.y = world.groundY;
}

function getFrameRect(frameIndex) {
  if (USE_FULL_GRID) {
    const col = frameIndex % GRID_COLS;
    const row = Math.floor(frameIndex / GRID_COLS);
    return { sx: col * frameW, sy: row * frameH, sw: frameW, sh: frameH };
  }
  const col = frameIndex % GRID_COLS;
  const row = Math.floor(frameIndex / GRID_COLS);
  return {
    sx: MANUAL_START_X + col * (MANUAL_FRAME_W + MANUAL_GAP_X),
    sy: MANUAL_START_Y + row * (MANUAL_FRAME_H + MANUAL_GAP_Y),
    sw: MANUAL_FRAME_W,
    sh: MANUAL_FRAME_H,
  };
}

function detectFootY(frameIndex) {
  const { sx, sy, sw, sh } = getFrameRect(frameIndex);
  const temp = document.createElement('canvas');
  temp.width = sw;
  temp.height = sh;
  const tctx = temp.getContext('2d', { willReadFrequently: true });
  tctx.clearRect(0, 0, sw, sh);
  tctx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = tctx.getImageData(0, 0, sw, sh).data;

  for (let y = sh - 1; y >= 0; y -= 1) {
    for (let x = 0; x < sw; x += 1) {
      const alpha = data[(y * sw + x) * 4 + 3];
      if (alpha > 10) return y;
    }
  }
  return sh - 1;
}

function buildFootOffsets() {
  const frames = [IDLE_FRAME, ...RUN_SEQUENCE];
  baselineFoot = 0;
  frames.forEach((f) => {
    const foot = detectFootY(f);
    footOffsets.set(f, foot);
    baselineFoot = Math.max(baselineFoot, foot);
  });
}

function currentFrame() {
  const moving = keys.a || keys.d;
  if (!moving) return IDLE_FRAME;
  return RUN_SEQUENCE[player.runIdx];
}

function update(dt) {
  let inputX = 0;
  if (keys.a) inputX -= 1;
  if (keys.d) inputX += 1;

  player.vx = inputX * player.speed;
  if (inputX !== 0) player.facing = inputX;

  world.scrollX += player.vx * dt;

  if (keys.space && player.onGround) {
    player.vy = -player.jumpPower;
    player.onGround = false;
  }

  player.vy += world.gravity * dt;
  player.y += player.vy * dt;

  if (player.y >= world.groundY) {
    player.y = world.groundY;
    player.vy = 0;
    player.onGround = true;
  }

  if (inputX !== 0) {
    player.frameTimer += dt;
    if (player.frameTimer >= player.frameInterval) {
      player.frameTimer = 0;
      player.runIdx = (player.runIdx + 1) % RUN_SEQUENCE.length;
    }
  } else {
    player.runIdx = 0;
  }
}

function drawBackground() {
  ctx.fillStyle = '#071632';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#163668';
  for (let i = 0; i < 80; i += 1) {
    const x = ((i * 173 - world.scrollX * 0.12) % (canvas.width + 200)) - 100;
    const y = 40 + (i * 41) % (canvas.height * 0.45);
    ctx.fillRect(x, y, 2, 2);
  }

  const offset = ((-world.scrollX % world.tileW) + world.tileW) % world.tileW;
  for (let x = -world.tileW; x < canvas.width + world.tileW; x += world.tileW) {
    const drawX = x + offset;
    ctx.fillStyle = '#1f3a73';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, world.tileH);
    ctx.fillStyle = '#66a0ff';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, 5);
  }
}

function drawPlayer() {
  const frame = currentFrame();
  const { sx, sy, sw, sh } = getFrameRect(frame);

  const scale = Math.min(player.targetW / sw, player.targetH / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;

  const foot = footOffsets.get(frame) ?? (sh - 1);
  const footShiftPx = (baselineFoot - foot) * scale;

  ctx.save();
  ctx.translate(player.x, player.y + footShiftPx);
  ctx.scale(player.facing, 1);
  ctx.drawImage(sprite, sx, sy, sw, sh, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}

let last = 0;
function loop(ts) {
  const dt = Math.min((ts - last) / 1000, 0.033);
  last = ts;

  update(dt);
  drawBackground();

  if (sprite.complete && sprite.naturalWidth > 0) {
    drawPlayer();
  } else {
    ctx.fillStyle = '#d7e7ff';
    ctx.font = '20px sans-serif';
    ctx.fillText('char_run_001.png 로딩 중...', 30, 50);
  }

  requestAnimationFrame(loop);
}

sprite.onload = () => {
  frameW = sprite.width / GRID_COLS;
  frameH = sprite.height / GRID_ROWS;
  buildFootOffsets();
  resizeCanvas();
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'Space') {
    keys.space = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'Space') keys.space = false;
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);
