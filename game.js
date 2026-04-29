const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SPRITE_SHEET = 'char_run_001.png';
const GRID_COLS = 8;
const GRID_ROWS = 2;

// 1(16) = idle, run loop = 2~15
const IDLE_FRAME = 15;
const RUN_SEQUENCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const keys = { a: false, d: false, space: false };

const world = {
  gravity: 1800,
  groundRatio: 0.84,
  groundY: 0,
  tileW: 280,
  tileH: 22,
  scrollX: 0,
};

const player = {
  x: 0,
  y: 0,
  w: 122,
  h: 184,
  vx: 0,
  vy: 0,
  speed: 320,
  jumpPower: 700,
  facing: 1,
  onGround: true,
  runIdx: 0,
  frameTimer: 0,
  frameInterval: 0.065,
};

const sprite = new Image();
sprite.src = SPRITE_SHEET;

let frameW = 256;
let frameH = 384;
const frameAnchors = [];

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.x = window.innerWidth * 0.5;
  world.groundY = Math.floor(window.innerHeight * world.groundRatio);
  if (player.onGround) player.y = world.groundY;
}

function getFrameRect(frameIndex) {
  const col = frameIndex % GRID_COLS;
  const row = Math.floor(frameIndex / GRID_COLS);
  return {
    sx: col * frameW,
    sy: row * frameH,
    sw: frameW,
    sh: frameH,
  };
}

function buildFrameAnchors() {
  frameAnchors.length = GRID_COLS * GRID_ROWS;

  const probe = document.createElement('canvas');
  probe.width = frameW;
  probe.height = frameH;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  for (let frame = 0; frame < GRID_COLS * GRID_ROWS; frame += 1) {
    pctx.clearRect(0, 0, frameW, frameH);
    const { sx, sy, sw, sh } = getFrameRect(frame);
    pctx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);

    const data = pctx.getImageData(0, 0, frameW, frameH).data;
    let minX = frameW; let maxX = 0;
    let minY = frameH; let maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < frameH; y += 1) {
      for (let x = 0; x < frameW; x += 1) {
        const alpha = data[(y * frameW + x) * 4 + 3];
        if (alpha > 12) {
          hasPixel = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    frameAnchors[frame] = hasPixel
      ? { minX, maxX, minY, maxY, footY: maxY }
      : { minX: 0, maxX: frameW, minY: 0, maxY: frameH, footY: frameH };
  }
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
    player.frameTimer = 0;
  }
}

function drawBackground() {
  ctx.fillStyle = '#0a1d40';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.fillStyle = '#102b58';
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 211 - world.scrollX * 0.18) % (window.innerWidth + 220)) - 110;
    const y = 40 + (i * 57) % 220;
    ctx.fillRect(x, y, 2, 2);
  }

  const offset = ((-world.scrollX % world.tileW) + world.tileW) % world.tileW;
  for (let x = -world.tileW; x < window.innerWidth + world.tileW; x += world.tileW) {
    const drawX = x + offset;
    ctx.fillStyle = '#213b78';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, world.tileH);
    ctx.fillStyle = '#5b84d4';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, 4);
  }
}

function drawPlayer() {
  const frame = player.vx === 0 ? IDLE_FRAME : RUN_SEQUENCE[player.runIdx];
  const { sx, sy, sw, sh } = getFrameRect(frame);
  const anchor = frameAnchors[frame] || { footY: sh };

  const scale = Math.min(player.w / sw, player.h / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const footOffset = (sh - anchor.footY) * scale;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.facing, 1);
  ctx.drawImage(sprite, sx, sy, sw, sh, -drawW / 2, -drawH + footOffset, drawW, drawH);
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
  }

  requestAnimationFrame(loop);
}

sprite.onload = () => {
  frameW = Math.floor(sprite.width / GRID_COLS);
  frameH = Math.floor(sprite.height / GRID_ROWS);
  buildFrameAnchors();
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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

requestAnimationFrame(loop);
