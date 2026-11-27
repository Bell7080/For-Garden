import subprocess, os
from PIL import Image, ImageDraw, ImageFont
D = '/tmp/claude-0/d3'
os.makedirs(f'{D}/csubs', exist_ok=True)
FONT = f'{D}/nk_ExtraBold.ttf'
W, H = 1080, 1920
YEL = (255, 224, 102)

# (시작, 끝, 문구) — {} 안은 노란 강조, | 는 줄바꿈
SUBS = [
 (0.15,3.2,'콤프소그나투스가|왜 {멸종}했는지 아세요?'),
 (3.4,5.3,'약 {1억 5천만 년} 전,'),(5.3,7.2,'지금의 {독일}|바닷가 섬에 살던'),(7.4,9.3,'{닭만 한}|작은 공룡이에요'),
 (9.4,12.2,'날쌔게 뛰어다니며|{도마뱀}을 잡아먹었는데'),(12.3,15.4,'실제로 배 속에서|{도마뱀 화석}이 나왔어요!'),
 (15.8,18.6,'그런데 사는 곳이|{작은 섬}들이었어요'),(19.1,22.4,'덥고 메마른 섬이라|먹이가 {늘 모자랐고}'),
 (22.4,26.3,'바닷물 높이가 바뀔 때마다|땅도 {줄었다 늘었다}'),(27.0,30.7,'같은 섬의 {새의 조상}들과|먹이를 두고 다퉜을 거래요'),
 (31.2,34.0,'그렇다면 {먹이}가 부족해서|사라졌을까요?'),(34.6,36.5,'{먹이만}의 문제는|아니었어요'),(36.8,41.3,'진짜 마지막은|쥐라기가 끝나며 바뀐 {기후} 때문'),
 (41.4,44.5,'쥐라기 끝 무렵|{바닷물}이 크게 빠지면서'),(44.9,48.6,'얕은 바다의 섬들이|{말라} 갔어요'),
 (49.4,53.8,'촉촉하던 날씨도|{건기}와 {우기}가 뚜렷해지며'),(53.8,55.6,'{메말라} 갔고요'),
 (56.6,61.6,'숨을 덤불도, 도마뱀도|{하나둘} 줄어들었죠'),(62.4,66.5,'작은 공룡에게는|{버티기 힘든} 변화'),
 (66.7,70.1,'운석이 떨어지기|{8천만 년}도 더 전에'),(70.4,73.6,'조용히|{화석} 속으로 사라졌어요'),
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
    render(t, f'{D}/csubs/{i:02d}.png', 100 if i == 0 else 84)

# 장면 → 클립
B = [0,3.4,7.3,9.4,15.6,19.0,22.4,26.8,31.1,36.7,41.3,49.2,56.3,61.8,66.6,74.4]
SC = ['cf/'+x for x in 'hook era size hunt island dry tide rival question climate retreat season lizards alone fossil'.split()]
FR = [round(x * 30) for x in B]
os.makedirs(f'{D}/cclips', exist_ok=True)
lst = []
for i, s in enumerate(SC):
    n = FR[i + 1] - FR[i]
    out = f'{D}/cclips/{i:02d}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{D}/{s}/%04d.jpg',
                    '-frames:v', str(n), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', out], check=True)
    lst.append(f"file '{out}'")
open(f'{D}/cclips/list.txt', 'w').write('\n'.join(lst))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{D}/cclips/list.txt',
                '-c', 'copy', f'{D}/cclips/video.mp4'], check=True)

# 목소리·효과음·배경음
VO = [('cmp/f1',0.15),('cmp/f2',3.4),('cmp/f3',15.8),('cmp/f4',31.2),('cmp/f5',41.4),('cmp/f6',66.7)]
UI = '/home/user/For-Garden/public/audio'
U = f'{UI}/ui/'
SFX = [(U+'ui-tap.mp3',1.25,.5),(U+'ui-tap.mp3',3.9,.4),(U+'ui-tap.mp3',5.4,.4),(U+'ui-confirm.mp3',7.6,.4),
       (U+'ui-feed.mp3',11.8,.45),(U+'ui-unlock.mp3',12.4,.4),(U+'ui-tap.mp3',15.9,.4),(U+'ui-deny.mp3',20.0,.35),
       (U+'ui-tap.mp3',23.4,.35),(U+'ui-tap.mp3',28.0,.4),(U+'ui-tap.mp3',31.7,.45),(U+'ui-deny.mp3',34.5,.45),
       (U+'ui-unlock.mp3',37.6,.4),(U+'ui-tap.mp3',42.2,.35),(U+'ui-tap.mp3',50.3,.35),(U+'ui-panel-close.mp3',62.2,.35),
       (U+'ui-danger.mp3',67.0,.3),(U+'formation-place.mp3',70.1,.45),(U+'ui-reward.mp3',72.0,.35)]
inputs = ['-i', f'{D}/cclips/video.mp4']
for v, _ in VO: inputs += ['-i', f'{D}/vo/{v}.wav']
for s, _, _ in SFX: inputs += ['-i', s]
inputs += ['-stream_loop', '-1', '-i', f'{UI}/bgm/bgm-lobby.mp3']
for i in range(len(SUBS)): inputs += ['-i', f'{D}/csubs/{i:02d}.png']
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
fc.append(f'[{bgm}:a]aresample=48000,atrim=0:74.4,volume=0.22,afade=t=in:d=0.6,afade=t=out:st=72.6:d=1.8[bg]')
fc.append('[bg][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bgd]')
fc.append('[vo2][sfx][bgd]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:74.4[aout]')
prev = '[0:v]'
for i, (a, b, t) in enumerate(SUBS):
    lab = f'[o{i}]'
    fc.append(f"{prev}[{k}:v]overlay=0:0:enable='between(t,{a},{b - 0.001})'{lab}")
    prev = lab; k += 1
fc.append(f'{prev}format=yuv420p[vout]')
out = f'{D}/out_compso.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                '-t', '74.4', '-movflags', '+faststart', out], check=True)
print('ok', out)
