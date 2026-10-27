# 사운드 출처와 라이선스

이 폴더의 음원은 두 갈래다. 다른 곳에서 받은 음원은 없다.

## 1. 응태가 직접 넣은 BGM — 손대지 않음

- `bgm/bgm-glass-city.mp3`
- `bgm/bgm-research-spire.mp3`

이 두 곡은 2026-10-27 교체 작업에서 파일·음량을 바꾸지 않았다.

## 2. ElevenLabs로 생성한 음원 (그 밖의 전부)

- **생성**: ElevenLabs, 응태 계정(**Starter 요금제 — 상업적 사용 가능**), 2026-10-27
- **모델**: 효과음 `eleven_text_to_sound_v2`, 음악 `eleven_music_v2_5`
- **작업 캔버스(Flow)**: `oLMXeVguBotBvV3vpiYR`. 아래 생성 ID로 원본 테이크를 다시 찾을 수 있다.
- **후처리**: ffmpeg로 무음을 다듬고 묶음별 음량을 맞췄다(UI −17 · 전투 −15 · 징글 −16 · 큰 연출 −14 dBFS 유효 RMS, 리미터 0.84). 효과음은 모노 96 kbps, BGM은 −14 LUFS · 128 kbps 스테레오다. BGM은 끝 2.5초를 앞머리에 겹쳐 녹여 쉬지 않고 돈다.
- 라이선스 조건은 ElevenLabs 이용약관(유료 요금제의 상업적 사용 권한)을 따른다. 요금제를 무료로 내리면 그 뒤에 만든 음원에는 상업적 사용 권한이 없으므로, 새 음원을 더할 때는 유료 요금제에서 만든다.
- 이 문서에는 API 키나 계정 비밀값을 적지 않는다.

### BGM

| 파일 | 길이 | 쓰는 화면 |
| --- | --- | --- |
| `bgm/bgm-title.mp3` | 약 2분 57초 | 타이틀·오프닝·로비 |
| `bgm/bgm-battle.mp3` | 약 2분 57초 | 일반 전투·아레나 대전 |
| `bgm/bgm-boss.mp3` | 약 2분 57초 | 레이드·원정 보스 전투 |
| `bgm/bgm-shop.mp3` | 약 2분 29초 | 상점·프리미엄 상점 |

화면과 곡의 대응은 `src/core/bgmPlan.ts`의 `SCENE_TRACK` 한 표가 갖는다.

### 효과음

| 파일 | 생성 ID | 프롬프트 |
| --- | --- | --- |
| `ui/ui-click.mp3` | `4AAsZ1zyEBwYKL27Lkki` | Soft crisp mobile game UI button tap, short glassy click with a tiny bright digital tick, clean, no reverb |
| `ui/ui-tap.mp3` | `ysHLnZqQM4ib9nwnaZMo` | Very faint soft airy tick, tiny muted digital blip for tapping empty screen, subtle and gentle, close-mic, no reverb |
| `ui/ui-back.mp3` | `pVjY3TlTX2idW3Gz03PK` | Soft mobile game back button sound, short descending two-tone glassy blip with a light reverse swish, clean UI cancel |
| `ui/ui-tab.mp3` | `EZx634YLucdUIGmQ4Eyv` | Light quick holographic swipe for switching tabs, short airy whoosh with a soft digital tick at the end, clean game UI |
| `ui/ui-toggle.mp3` | `8j4f7rjhwj1q71MoJO2c` | Small switch toggle click, crisp tiny plastic snap with a soft digital tick, game settings |
| `ui/ui-panel-open.mp3` | `MSFAnmo1jl4B1yrEAWat` | Holographic panel popping open, soft rising glassy shimmer with a gentle bright pop, futuristic mobile game UI window open |
| `ui/ui-panel-close.mp3` | `2pSoYWzPwKzMEFNg8ryC` | Holographic panel closing, soft short descending glassy swish ending in a muted tick, futuristic mobile game UI window close |
| `ui/ui-confirm.mp3` | `fSj3fRdVirgxguKrh5Hj` | Positive confirm button chime, two quick bright ascending bell notes with a soft sparkle, clean mobile game UI |
| `ui/ui-deny.mp3` | `ARW6XRrHiLRjX2oOw7eh` | Soft error buzz for a locked or unavailable button, short low muted double bonk, gentle not harsh, mobile game UI |
| `ui/ui-reward.mp3` | `NVrgxR0DJfeUZoAGc2qy` | Reward obtained sound, bright sparkling magical chime cascade with tinkling coins and gems, satisfying and joyful mobile game item get |
| `ui/ui-unlock.mp3` | `PjRHJkKuj33rYnM24vbO` | Padlock clicking open followed by a bright magical unlock shimmer and soft rising chime, new content unlocked in a mobile game |
| `ui/ui-purchase.mp3` | `hhrzFHTFcmBL9iy8qsX2` | Purchase complete sound, crisp coin clink and cash register ding with a short sparkle, satisfying mobile game shop buy |
| `ui/ui-feed.mp3` | `JqnoqXTBesZo9MOmNTNy` | Cute small creature munching a bite of cake, quick soft chomp with a tiny cheerful pop, cartoon, close-mic |
| `ui/ui-breakthrough.mp3` | `R09Qj5MfVFyGiKuoiWzH` | Powerful magical power-up burst, deep whoomp followed by a bright crystalline shatter and rising shimmering sparkle, character limit break in an anime game |
| `ui/ui-levelup.mp3` | `khZ7AaVvL0LYnR9J8XG6` | Very short level up jingle for a mobile game, quick ascending sparkling harp and bell arpeggio into a bright brass major chord hit. Joyful and rewarding. Instrumental. |
| `ui/rune-success.mp3` | `85xCix7z44RkiYy6E2xI` | Gem enhancement success, bright clear crystal ding with a quick upward sparkle, satisfying |
| `ui/rune-fail.mp3` | `dCd575FwJkbOpIf7zbPu` | Gem enhancement failed, dull stone thud with a small crumbling crack and fizzle, disappointing but soft |
| `ui/rune-engrave.mp3` | `5LIYWmDIHi28o51QDpH9` | Golden engraving complete, resonant warm metallic chime with a long shimmering magical tail, precious and rewarding |
| `research/research-crack.mp3` | `pLzUfrPXS2GLolFTGJt2` | Ancient fossil stone cracking open, sharp rocky crack splitting with small debris crumbling, followed by a faint magical glow hum |
| `research/reveal-common.mp3` | `FIna3YmxqDposfFWMtfW` | Card flipping over on a table, quick light paper flip with a soft whoosh, gacha card reveal common |
| `research/reveal-sr.mp3` | `66XAt4kFXzJ3z5bdDYyV` | Rare gacha card reveal, quick card flip followed by a magical purple shimmer and bright rising chime |
| `research/reveal-ssr.mp3` | `h8DMiH0zuxP6x2H1iFdT` | Legendary gacha card reveal, powerful golden burst with a choir swell, brilliant sparkling chimes and a deep boom, triumphant and dazzling |
| `research/research-omen.mp3` | `xg0xo8NbfVkPGcL7vtvU` | Deep ground rumbling in four accelerating heavy thuds, earth cracking, ending in a huge bright explosive flash boom with shimmering tail |
| `research/research-showcase.mp3` | `48wjNsBoR0prVY3rw6p6` | New character appears, bright magical whoosh rising into a shining sparkle burst with a soft bell, anime character introduction |
| `archaeology/dig-hit.mp3` | `EJnlicNGDSSq0ITB7yUd` | Pickaxe striking dirt and stone, sharp metallic clang with crumbling soil and pebbles, single hit |
| `archaeology/dig-treasure.mp3` | `isuF1jHiodi793df01ni` | Rare treasure found while digging, bright twinkling magical sparkle with a shiny chime, precious gem discovered |
| `battle/battle-hit.mp3` | `lGt3jGyByMhpPc41Ukw4` | Short punchy cartoon melee hit, quick soft thwack impact, anime game combat, dry, very short |
| `battle/battle-hit-magic.mp3` | `JpBHBSWv3rLDXXzXDheh` | Short magic projectile hit, quick bright sparkling zap impact, anime game spell, dry, very short |
| `battle/battle-crit.mp3` | `aij3BqFv8LQFRDAVJ13T` | Critical hit, sharp sword slash swish into a heavy crunchy impact with a bright metallic ring, anime game combat |
| `battle/battle-heal.mp3` | `JSkBAynKSr2YwRbmqSHl` | Gentle healing spell, soft warm rising chime with airy sparkles, restorative and calm, game heal |
| `battle/battle-shield.mp3` | `mQMrzzwq403wcqsD7XRT` | Energy shield activating, quick resonant electric hum swelling into a glassy barrier shimmer, sci-fi game |
| `battle/battle-death.mp3` | `5DIyNpzT0vlEv6t9sEbK` | Cartoon knockout, comical bonk followed by a fast rising whistle flying away and a tiny twinkle star ping |
| `battle/battle-cutin.mp3` | `NMrHTljgw1A3HeJgeh2Z` | Anime special move cut-in, fast sharp swoosh with a bright metallic shing and rising energy charge |
| `battle/battle-ultimate.mp3` | `OajKRv8fSnNAF2UjBvOz` | Massive special attack impact, powerful magical explosion boom with a crackling energy blast and debris, anime game ultimate skill |
| `battle/battle-fever.mp3` | `aEiRXWUxc2WVt3SiCVvT` | Cute monster entering rage mode, short angry beastly growl layered with a fiery power-up flare whoosh, game berserk |
| `battle/battle-start.mp3` | `fNYCPg89Nszz38JxF1mI` | Battle start signal, bold taiko drum hit with a sharp sword unsheathing ring and short brass stab, energetic game round begin |
| `battle/battle-victory.mp3` | `Ter9uegqIRPoj19T7XQR` | Short triumphant victory fanfare jingle for an anime RPG, bright brass and strings with a snare roll, cheerful glockenspiel, rising to a big major chord finish that rings out. Instrumental. |
| `battle/battle-defeat.mp3` | `PP39J6f7CD4bA2U266xD` | Short gentle defeat jingle for a cute anime RPG, slow descending melancholic piano and soft strings, minor key, ends on a soft unresolved chord fading out. Sad but not harsh. Instrumental. |
| `story/story-explosion.mp3` | `4l4YlFK6Lk7IbsSWodTN` | Large building explosion, deep heavy boom with debris and glass shattering, rumbling tail |
| `story/story-alarm.mp3` | `vO6PmBOSdrRhx57NjjSP` | Facility emergency alarm siren, pulsing electronic warning tone, two cycles, sci-fi lab |
| `story/story-rumble.mp3` | `Suwlny2WhXOA2xrWL1VM` | Low ground tremor rumbling, building shaking with rattling objects, short earthquake |
| `story/story-impact.mp3` | `0rA9lVxzjEWkSwAvvlPF` | Comical body collision bump, soft heavy thud with a cartoon boing, two characters bumping into each other |
| `battle/raid-summon.mp3` | `WqZGgtPxq0Dnt5PW4QcK` | Dark magical seal charging with swirling ominous energy, building tension, then a violent burst explosion and a deep monster roar |
| `ui/title-start.mp3` | `CuOlqyRhmMb27qQi0oR0` | Game start button, bright magical whoosh into a rich shimmering chime swell, inviting and grand |
