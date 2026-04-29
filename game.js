const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SPRITE_SHEET = 'char_run_001.png';

// 시트가 8x2로 깔끔하게 잘린 경우 true, 원본 큰 시트(라벨 포함)이면 false로 두고 아래 수동 좌표 사용.
const USE_FULL_GRID = true;
const GRID_COLS = 8;
const GRID_ROWS = 2;

// 원본 시트 대응용 수동 프레임 데이터(필요 시 값 조정)
const MANUAL_FRAME_W = 190;
const MANUAL_FRAME_H = 210;
const MANUAL_START_X = 58;
const MANUAL_START_Y = 292;
const MANUAL_GAP_X = 58;
const MANUAL_GAP_Y = 204;

// 1번 프레임을 버리고 16번 프레임을 1번 자리에 배치한 순서 (요청사항 반영)
// 즉: 16,2,3,4,...,15
const ANIM_SEQUENCE = [15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const keys = { a: false, d: false, space: false };

const world = {
  gravity: 1400,
  groundY: 420,
  tileW: 280,
  tileH: 20,
  scrollX: 0,
};

const player = {
  x: canvas.width / 2,
  y: world.groundY,
  w: 122,
  h: 184,
  vx: 0,
  vy: 0,
  speed: 290,
  jumpPower: 620,
  facing: 1,
  onGround: true,
  animIdx: 0,
  frameTimer: 0,
  frameInterval: 0.07,
};

const sprite = new Image();
sprite.src = SPRITE_SHEET;

let frameW = 256;
let frameH = 384;

function getFrameRect(frameIndex) {
  if (USE_FULL_GRID) {
    const col = frameIndex % GRID_COLS;
    const row = Math.floor(frameIndex / GRID_COLS);
    return {
      sx: col * frameW,
      sy: row * frameH,
      sw: frameW,
      sh: frameH,
    };
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

function update(dt) {
  let inputX = 0;
  if (keys.a) inputX -= 1;
  if (keys.d) inputX += 1;

  player.vx = inputX * player.speed;
  if (inputX !== 0) player.facing = inputX;

  // 무한맵 느낌: 플레이어는 중앙 근처 유지, 월드 스크롤만 계속 이동
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

  const moving = inputX !== 0;
  if (moving) {
    player.frameTimer += dt;
    if (player.frameTimer >= player.frameInterval) {
      player.frameTimer = 0;
      player.animIdx = (player.animIdx + 1) % ANIM_SEQUENCE.length;
    }
  } else {
    player.animIdx = 0;
  }
}

function drawBackground() {
  ctx.fillStyle = '#0a1d40';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#102b58';
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 211 - world.scrollX * 0.18) % (canvas.width + 220)) - 110;
    const y = 40 + (i * 57) % 180;
    ctx.fillRect(x, y, 2, 2);
  }

  const offset = ((-world.scrollX % world.tileW) + world.tileW) % world.tileW;
  for (let x = -world.tileW; x < canvas.width + world.tileW; x += world.tileW) {
    const drawX = x + offset;
    ctx.fillStyle = '#213b78';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, world.tileH);
    ctx.fillStyle = '#5b84d4';
    ctx.fillRect(drawX, world.groundY, world.tileW - 8, 4);
  }
}

function drawPlayer() {
  const frame = ANIM_SEQUENCE[player.animIdx];
  const { sx, sy, sw, sh } = getFrameRect(frame);

  // 원본 비율 유지 축소 (눌림 방지)
  const scale = Math.min(player.w / sw, player.h / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;

  ctx.save();
  ctx.translate(player.x, player.y);
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
    ctx.fillText('char_run_001.png 로딩 중...', 20, 30);
  }

  requestAnimationFrame(loop);
}

sprite.onload = () => {
  frameW = sprite.width / GRID_COLS;
  frameH = sprite.height / GRID_ROWS;
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

requestAnimationFrame(loop);
