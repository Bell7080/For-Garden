const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SPRITE_SHEET = 'char_run_001.png';
const COLS = 8;
const ROWS = 2;
const RUN_FRAME_START = 0; // 시트 기준 1번 프레임
const RUN_FRAME_END = 14;  // 시트 기준 15번 프레임 (16번 미사용)

const sprite = new Image();
sprite.src = SPRITE_SHEET;

const keys = { a: false, d: false };

const world = {
  groundY: 430,
  platform: { x: 80, y: 430, w: 800, h: 22 },
};

const player = {
  x: canvas.width / 2,
  y: world.groundY,
  w: 96,
  h: 144,
  speed: 250,
  facing: 1,
  frame: RUN_FRAME_START,
  frameTimer: 0,
  frameInterval: 0.08,
};

let frameW = 256;
let frameH = 384;

function update(dt) {
  let moving = false;
  if (keys.a) {
    player.x -= player.speed * dt;
    player.facing = -1;
    moving = true;
  }
  if (keys.d) {
    player.x += player.speed * dt;
    player.facing = 1;
    moving = true;
  }

  const leftBound = world.platform.x + player.w / 2;
  const rightBound = world.platform.x + world.platform.w - player.w / 2;
  player.x = Math.max(leftBound, Math.min(rightBound, player.x));

  if (moving) {
    player.frameTimer += dt;
    if (player.frameTimer >= player.frameInterval) {
      player.frameTimer = 0;
      if (player.frame >= RUN_FRAME_END) {
        player.frame = RUN_FRAME_START;
      } else {
        player.frame += 1;
      }
    }
  } else {
    player.frame = RUN_FRAME_START;
  }
}

function drawBackground() {
  ctx.fillStyle = '#0a1d40';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#213b78';
  ctx.fillRect(world.platform.x, world.platform.y, world.platform.w, world.platform.h);
  ctx.fillStyle = '#5b84d4';
  ctx.fillRect(world.platform.x, world.platform.y, world.platform.w, 4);
}

function drawPlayer() {
  const sx = (player.frame % COLS) * frameW;
  const sy = Math.floor(player.frame / COLS) * frameH;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.facing, 1);
  ctx.drawImage(
    sprite,
    sx,
    sy,
    frameW,
    frameH,
    -player.w / 2,
    -player.h,
    player.w,
    player.h,
  );
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
    ctx.fillText('char_run_001.png 로딩 중...', 20, 30);
  }

  requestAnimationFrame(loop);
}

sprite.onload = () => {
  frameW = sprite.width / COLS;
  frameH = sprite.height / ROWS;
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 'd' || e.key === 'D') keys.d = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
});

requestAnimationFrame(loop);
