import subprocess, os
from PIL import Image, ImageDraw, ImageFont
D = '/tmp/claude-0/d3'
os.makedirs(f'{D}/msubs', exist_ok=True)
FONT = f'{D}/nk_ExtraBold.ttf'
W, H = 1080, 1920
YEL = (255, 224, 102)

# (시작, 끝, 문구) — {} 안은 노란 강조, | 는 줄바꿈
SUBS = [
 (0.10, 1.75, '피라미드를 지을 때,'),
 (1.75, 4.65, '매머드가 아직|{살아 있었다}는 거 아세요?'),
 (4.75, 6.78, '빙하기의|털북숭이 코끼리,'),
 (6.78, 7.84, '{매머드!}'),
 (7.84, 10.62, '키 {3m}에|몸무게 {6톤}'),
 (10.62, 14.55, '귀는 작고|털은 거의 {1m}나 됐대요'),
 (14.70, 17.64, '그런데 {만 년 전}쯤|빙하기가 끝나면서'),
 (17.64, 19.75, '풀밭이|{숲}으로 바뀌었고'),
 (19.75, 23.20, '사람들의 {사냥}까지 겹쳐|대부분 사라졌어요'),
 (23.30, 24.24, '{그런데!}'),
 (24.24, 25.50, '북극의 작은 섬'),
 (25.50, 28.43, '{브랑겔섬}에|끝까지 남은 무리가 있었어요'),
 (28.43, 30.73, '무려|{4천 년 전}까지요'),
 (30.73, 33.30, '{피라미드}가 다|지어진 뒤에도요!'),
 (33.40, 35.70, '하지만|그 마지막 무리도'),
 (35.70, 38.20, '결국 사라졌어요'),
 (38.20, 39.52, '이유는...'),
 (39.52, 41.50, '아직 {아무도}|몰라요'),
 (41.60, 43.78, '지금은|시베리아 얼음 속에서,'),
 (43.78, 47.00, '털까지 남은|{아기 매머드}가 나오기도 해요'),
 (47.00, 49.90, '언젠가 {다시}|만날 수 있을까요?'),
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
    render(t, f'{D}/msubs/{i:02d}.png', 100 if i == 0 else 88)

# 장면 → 클립
B = [0, 4.7, 14.6, 19.3, 23.2, 28.4, 33.3, 41.5, 50.0]
SC = ['mf/hook','mf/intro','mf/melt','mf/hunt','mf/island','mf/pyramid','mf/last','mf/ice']
FR = [round(x * 30) for x in B]
os.makedirs(f'{D}/mclips', exist_ok=True)
lst = []
for i, s in enumerate(SC):
    n = FR[i + 1] - FR[i]
    out = f'{D}/mclips/{i:02d}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{D}/{s}/%04d.jpg',
                    '-frames:v', str(n), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', out], check=True)
    lst.append(f"file '{out}'")
open(f'{D}/mclips/list.txt', 'w').write('\n'.join(lst))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/mclips/list.txt',
                '-c', 'copy', f'{D}/mclips/video.mp4'], check=True)

# 목소리·효과음·배경음
VO = [('m1', 0.1), ('m2', 4.75), ('m3', 14.7), ('m4', 23.3), ('m5', 33.4), ('m6', 41.6)]
UI = '/home/user/For-Garden/public/audio'
SFX = [(f'{UI}/ui/ui-tap.mp3', 0.95, .5), (f'{UI}/ui/ui-tap.mp3', 7.95, .45), (f'{UI}/ui/ui-tap.mp3', 8.95, .45),
       (f'{UI}/ui/ui-tap.mp3', 11.15, .4), (f'{UI}/ui/ui-confirm.mp3', 23.35, .45), (f'{UI}/ui/formation-place.mp3', 29.1, .4),
       (f'{UI}/ui/ui-confirm.mp3', 30.95, .45), (f'{UI}/ui/ui-tap.mp3', 38.25, .4), (f'{UI}/ui/ui-unlock.mp3', 42.15, .35)]
inputs = ['-i', f'{D}/mclips/video.mp4']
for v, _ in VO: inputs += ['-i', f'{D}/vo/{v}.wav']
for s, _, _ in SFX: inputs += ['-i', s]
inputs += ['-stream_loop', '-1', '-i', f'{UI}/bgm/bgm-lobby.mp3']
for i in range(len(SUBS)): inputs += ['-i', f'{D}/msubs/{i:02d}.png']
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
fc.append(f'[{bgm}:a]aresample=48000,atrim=0:50.0,volume=0.22,afade=t=in:d=0.6,afade=t=out:st=48.4:d=1.6[bg]')
fc.append('[bg][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bgd]')
fc.append('[vo2][sfx][bgd]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:50.0[aout]')
prev = '[0:v]'
for i, (a, b, t) in enumerate(SUBS):
    lab = f'[o{i}]'
    fc.append(f"{prev}[{k}:v]overlay=0:0:enable='between(t,{a},{b - 0.001})'{lab}")
    prev = lab; k += 1
fc.append(f'{prev}format=yuv420p[vout]')
out = f'{D}/out_mammoth.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                '-t', '50.0', '-movflags', '+faststart', out], check=True)
print('ok', out)
