import subprocess, os
from PIL import Image, ImageDraw, ImageFont
D = '/tmp/claude-0/d3'
os.makedirs(f'{D}/subs', exist_ok=True)
FONT = f'{D}/nk_ExtraBold.ttf'
W, H = 1080, 1920
YEL = (255, 224, 102)

# (시작, 끝, 문구) — {} 안은 노란 강조, | 는 줄바꿈
SUBS = [
 (0.10, 2.95, '도도새가 왜|{멸종}했는지 아세요?'),
 (2.95, 4.51, '인도양의 작은 섬'),
 (4.51, 5.69, '{모리셔스!}'),
 (5.69, 7.61, '천적이 하나도 없어서'),
 (7.61, 9.28, '날 필요도 없었대요'),
 (9.28, 10.35, '그런데'),
 (10.35, 12.42, '{1598년,}'),
 (12.42, 15.33, '사람들이|배를 타고 왔어요'),
 (15.33, 16.48, '도도새는...'),
 (16.48, 18.32, '도망칠 줄을 몰랐죠'),
 (18.32, 21.11, '{진짜 범인}은|따로 있었어요!'),
 (21.11, 23.74, '배에서 내린|쥐랑 돼지랑 원숭이가'),
 (23.74, 26.59, '땅바닥에 낳은 알을|다 먹어 버린 거예요!'),
 (26.59, 28.21, '마지막 목격은'),
 (28.21, 30.67, '{1662년.}'),
 (30.67, 32.27, '사람을 만난 지'),
 (32.27, 33.85, '{백 년}도 안 돼서요'),
 (33.85, 35.64, '지금 남은 건'),
 (35.64, 37.37, '뼈 몇 조각과'),
 (37.37, 40.00, '옛 그림 몇 장뿐이에요'),
]

def parse(line):
    segs, cur, hi = [], '', False
    for ch in line:
        if ch in '{}':
            if cur: segs.append((cur, hi))
            cur, hi = '', ch == '{'
        else:
            cur += ch
    if cur: segs.append((cur, hi))
    return segs

def render(text, path, size):
    lines = [parse(l) for l in text.split('|')]
    while True:
        f = ImageFont.truetype(FONT, size)
        widths = [sum(f.getlength(s) for s, _ in l) for l in lines]
        if max(widths) <= 820 or size < 60: break
        size -= 4
    stroke = max(8, size // 8)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lh = int(size * 1.22)
    cy = int(H * 0.63)
    y0 = cy - lh * len(lines) // 2
    cx = 515  # 오른쪽 버튼 열을 피해 살짝 왼쪽
    for i, l in enumerate(lines):
        x = cx - widths[i] / 2
        y = y0 + i * lh
        for s, hi in l:
            # 아래로 깔리는 그림자
            d.text((x + 5, y + 7), s, font=f, fill=(20, 12, 24, 170), stroke_width=stroke, stroke_fill=(20, 12, 24, 170))
            d.text((x, y), s, font=f, fill=YEL if hi else (255, 255, 255), stroke_width=stroke, stroke_fill=(42, 29, 46))
            x += f.getlength(s)
    im.save(path)

for i, (a, b, t) in enumerate(SUBS):
    render(t, f'{D}/subs/{i:02d}.png', 100 if i == 0 else 88)

# 장면 → 클립
B = [0, 2.95, 5.7, 8.98, 12.4, 15.0, 18.32, 20.9, 23.6, 26.6, 30.3, 33.85, 36.5, 40.0]
SC = ['hookf', 'full/island', 'full/forest', 'full/ship', 'full/landing', 'full/tilt', 'full/crate',
      'full/pop', 'full/nest', 'full/last', 'full/dissolve', 'full/museum', 'full/painting']
FR = [round(x * 30) for x in B]
os.makedirs(f'{D}/clips', exist_ok=True)
lst = []
for i, s in enumerate(SC):
    n = FR[i + 1] - FR[i]
    out = f'{D}/clips/{i:02d}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{D}/{s}/%04d.jpg',
                    '-frames:v', str(n), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', out], check=True)
    lst.append(f"file '{out}'")
open(f'{D}/clips/list.txt', 'w').write('\n'.join(lst))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/clips/list.txt',
                '-c', 'copy', f'{D}/clips/video.mp4'], check=True)

# 목소리·효과음·배경음
VO = [('l1', 0.1), ('l2', 2.95), ('l3', 9.28), ('l4', 18.32), ('l5', 26.59), ('l6b', 33.85)]
UI = '/home/user/For-Garden/public/audio'
SFX = [(f'{UI}/ui/ui-tap.mp3', 1.30, .5), (f'{UI}/ui/ui-confirm.mp3', 9.45, .45),
       (f'{UI}/ui/relic-poke.mp3', 21.98, .55), (f'{UI}/ui/relic-poke.mp3', 22.32, .55), (f'{UI}/ui/relic-poke.mp3', 22.85, .55),
       (f'{UI}/ui/ui-tap.mp3', 16.0, .45), (f'{UI}/ui/ui-confirm.mp3', 26.9, .45), (f'{UI}/ui/ui-danger.mp3', 19.5, .35)]
inputs = ['-i', f'{D}/clips/video.mp4']
for v, _ in VO: inputs += ['-i', f'{D}/vo/{v}.wav']
for s, _, _ in SFX: inputs += ['-i', s]
inputs += ['-stream_loop', '-1', '-i', f'{UI}/bgm/bgm-lobby.mp3']
for i in range(len(SUBS)): inputs += ['-i', f'{D}/subs/{i:02d}.png']
fc = []
k = 1
vlabels = []
for v, t in VO:
    ms = int(t * 1000); fc.append(f'[{k}:a]aresample=48000,adelay={ms}|{ms}[v{k}]'); vlabels.append(f'[v{k}]'); k += 1
fc.append(f"{''.join(vlabels)}amix=inputs={len(VO)}:normalize=0,volume=1.6[voice]")
fc.append('[voice]asplit=2[vo1][vo2]')
slabels = []
for s, t, g in SFX:
    ms = int(t * 1000); fc.append(f'[{k}:a]aresample=48000,volume={g},adelay={ms}|{ms}[s{k}]'); slabels.append(f'[s{k}]'); k += 1
fc.append(f"{''.join(slabels)}amix=inputs={len(SFX)}:normalize=0[sfx]")
bgm = k; k += 1
fc.append(f'[{bgm}:a]aresample=48000,atrim=0:40,volume=0.22,afade=t=in:d=0.6,afade=t=out:st=38.6:d=1.4[bg]')
fc.append('[bg][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bgd]')
fc.append('[vo2][sfx][bgd]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:40[aout]')
prev = '[0:v]'
for i, (a, b, t) in enumerate(SUBS):
    lab = f'[o{i}]'
    fc.append(f"{prev}[{k}:v]overlay=0:0:enable='between(t,{a},{b - 0.001})'{lab}")
    prev = lab; k += 1
fc.append(f'{prev}format=yuv420p[vout]')
out = f'{D}/out_v2.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                '-t', '40', '-movflags', '+faststart', out], check=True)
print('ok', out)
