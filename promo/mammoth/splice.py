# 매머드 v1의 「키 3m · 6톤」 컷(4.7~14.6초)만 도도새 → 사람 비교로 바꿔 끼운다. 목소리·배경음은 v1 그대로.
import os, subprocess
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__))
FF = r'C:\Users\pako1\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.1-full_build\bin\ffmpeg.exe'
SRC = os.path.join(os.path.dirname(D), 'cloudmam', 'm.mp4')
FONT = os.path.join(D, 'nk.woff2')
W, H = 1080, 1920
YEL = (255, 224, 102)
T0, T1 = 4.7, 14.6
# compose_m.py와 같은 자막·같은 양식 (해당 구간만)
SUBS = [
 (4.75, 6.78, '빙하기의|털북숭이 코끼리,'),
 (6.78, 7.84, '{매머드!}'),
 (7.84, 10.62, '키 {3m}에|몸무게 {6톤}'),
 (10.62, 14.55, '귀는 작고|털은 거의 {1m}나 됐대요'),
]
def parse(line):
    segs, cur, hi = [], '', False
    for ch in line:
        if ch in '{}':
            if cur: segs.append((cur, hi))
            cur, hi = '', ch == '{'
        else: cur += ch
    if cur: segs.append((cur, hi))
    return segs
def render(text, path, size=88):
    lines = [parse(l) for l in text.split('|')]
    while True:
        f = ImageFont.truetype(FONT, size)
        widths = [sum(f.getlength(s) for s, _ in l) for l in lines]
        if max(widths) <= 820 or size < 60: break
        size -= 4
    stroke = max(8, size // 8)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    lh = int(size * 1.22); cy = int(H * 0.63); y0 = cy - lh * len(lines) // 2; cx = 515
    for i, l in enumerate(lines):
        x = cx - widths[i] / 2; y = y0 + i * lh
        for s, hi in l:
            d.text((x + 5, y + 7), s, font=f, fill=(20, 12, 24, 170), stroke_width=stroke, stroke_fill=(20, 12, 24, 170))
            d.text((x, y), s, font=f, fill=YEL if hi else (255, 255, 255), stroke_width=stroke, stroke_fill=(42, 29, 46))
            x += f.getlength(s)
    im.save(path)
os.makedirs(os.path.join(D, 'subs'), exist_ok=True)
for i, (_, _, t) in enumerate(SUBS): render(t, os.path.join(D, 'subs', f'{i}.png'))

inputs = ['-i', SRC, '-framerate', '30', '-i', os.path.join(D, 'frames', '%04d.jpg')]
for i in range(len(SUBS)): inputs += ['-i', os.path.join(D, 'subs', f'{i}.png')]
fc = ['[1:v]setpts=PTS-STARTPTS,format=yuv420p,setsar=1[n0]']
prev = '[n0]'
for i, (a, b, _) in enumerate(SUBS):
    fc.append(f"{prev}[{i+2}:v]overlay=0:0:enable='between(t,{a-T0:.3f},{b-T0-0.001:.3f})'[n{i+1}]"); prev = f'[n{i+1}]'
fc.append(f'[0:v]trim=0:{T0},setpts=PTS-STARTPTS,setsar=1[a]')
fc.append(f'[0:v]trim={T1},setpts=PTS-STARTPTS,setsar=1[c]')
fc.append(f'{prev}trim=0:{T1-T0},setpts=PTS-STARTPTS,format=yuv420p[b]')
fc.append('[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[v]')
out = os.path.join(D, 'mammoth_v2.mp4')
subprocess.run([FF, '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '0:a',
               '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'copy', '-movflags', '+faststart', out], check=True)
print('ok', out)
