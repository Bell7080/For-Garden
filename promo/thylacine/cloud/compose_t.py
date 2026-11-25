import subprocess, os
from PIL import Image, ImageDraw, ImageFont
D = '/tmp/claude-0/d3'
os.makedirs(f'{D}/tsubs', exist_ok=True)
FONT = f'{D}/nk_ExtraBold.ttf'
W, H = 1080, 1920
YEL = (255, 224, 102)

# (시작, 끝, 문구) — {} 안은 노란 강조, | 는 줄바꿈
SUBS = [
 (0.2, 3.0, '딱 {59일} 만에|사라진 주머니늑대!'),
 (3.8, 7.5, '인간에게 보호받은 지,|딱 {59일} 만에요'),
 (7.7, 8.85, '얼굴은 {늑대},'),
 (8.85, 11.15, '등에는|{호랑이 줄무늬}'),
 (11.15, 15.6, '배에는 캥거루처럼|새끼 키우는 {주머니}!'),
 (15.6, 19.6, '입은 무려|{80도}까지 쩍!'),
 (19.9, 21.3, '{그런데}'),
 (21.3, 24.9, '사람들은 주머니늑대가|{양}을 잡아먹는다고 생각했어요'),
 (24.9, 26.9, '그래서 {현상금}을 걸었고'),
 (26.9, 29.3, '{2천 마리}가 넘게|사냥됐죠'),
 (29.4, 31.8, '{1936년 7월},'),
 (31.8, 34.8, '드디어|{보호종}이 됐어요'),
 (34.8, 37.5, '하지만 겨우|{59일} 뒤...'),
 (37.6, 41.6, '호바트 동물원의|{마지막 한 마리}가'),
 (41.6, 43.6, '세상을 떠났어요'),
 (43.7, 45.1, '그런데요,'),
 (45.1, 48.3, '지금도 {봤다는 사람}이|계속 나온대요'),
 (48.3, 51.6, '정말 어딘가에|{숨어 있는} 건 아닐까요?'),
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
    render(t, f'{D}/tsubs/{i:02d}.png', 100 if i == 0 else 84)

# 장면 → 클립
B = [0, 7.65, 19.6, 29.3, 37.5, 43.6, 52.0]
SC = ['tf/hook','tf/intro','tf/bounty','tf/protect','tf/zoo','tf/sight']
FR = [round(x * 30) for x in B]
os.makedirs(f'{D}/tclips', exist_ok=True)
lst = []
for i, s in enumerate(SC):
    n = FR[i + 1] - FR[i]
    out = f'{D}/tclips/{i:02d}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{D}/{s}/%04d.jpg',
                    '-frames:v', str(n), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', out], check=True)
    lst.append(f"file '{out}'")
open(f'{D}/tclips/list.txt', 'w').write('\n'.join(lst))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/tclips/list.txt',
                '-c', 'copy', f'{D}/tclips/video.mp4'], check=True)

# 목소리·효과음·배경음
VO = [('thy/t1', 0.1), ('thy/t2', 7.7), ('thy/t3', 19.8), ('thy/t4', 29.4), ('thy/t5', 37.6), ('thy/t6', 43.7)]
UI = '/home/user/For-Garden/public/audio'
SFX = [(f'{UI}/ui/ui-tap.mp3', 0.6, .5), (f'{UI}/ui/ui-tap.mp3', 7.85, .45), (f'{UI}/ui/ui-tap.mp3', 9.45, .45),
       (f'{UI}/ui/ui-unlock.mp3', 11.3, .35), (f'{UI}/ui/ui-confirm.mp3', 16.25, .45), (f'{UI}/ui/ui-confirm.mp3', 24.7, .45),
       (f'{UI}/ui/ui-tap.mp3', 26.6, .4), (f'{UI}/ui/formation-place.mp3', 31.8, .45), (f'{UI}/ui/ui-tap.mp3', 34.7, .4),
       (f'{UI}/ui/ui-tap.mp3', 41.4, .35), (f'{UI}/ui/ui-unlock.mp3', 48.3, .35)]
inputs = ['-i', f'{D}/tclips/video.mp4']
for v, _ in VO: inputs += ['-i', f'{D}/vo/{v}.wav']
for s, _, _ in SFX: inputs += ['-i', s]
inputs += ['-stream_loop', '-1', '-i', f'{UI}/bgm/bgm-lobby.mp3']
for i in range(len(SUBS)): inputs += ['-i', f'{D}/tsubs/{i:02d}.png']
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
fc.append(f'[{bgm}:a]aresample=48000,atrim=0:52.0,volume=0.22,afade=t=in:d=0.6,afade=t=out:st=50.4:d=1.6[bg]')
fc.append('[bg][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bgd]')
fc.append('[vo2][sfx][bgd]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:52.0[aout]')
prev = '[0:v]'
for i, (a, b, t) in enumerate(SUBS):
    lab = f'[o{i}]'
    fc.append(f"{prev}[{k}:v]overlay=0:0:enable='between(t,{a},{b - 0.001})'{lab}")
    prev = lab; k += 1
fc.append(f'{prev}format=yuv420p[vout]')
out = f'{D}/out_thylacine.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                '-t', '52.0', '-movflags', '+faststart', out], check=True)
print('ok', out)
