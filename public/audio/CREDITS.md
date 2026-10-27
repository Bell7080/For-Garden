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
| `bgm/bgm-title.mp3` | 약 2분 57초 | 부트·타이틀·오프닝 — 열차 안 토리카, 레일 리듬의 잔잔한 피아노·기타 (생성 ID `YCz6BZ30bNeLkuDTtYUI`, v0.363.0에서 교체) |
| `bgm/bgm-lobby.mp3` | 약 2분 57초 | 로비(연구소) — 잔잔한 일렉 피아노·나일론 기타 (생성 ID `dESXuOzV94iTqLRqAbF9`, v0.363.0) |
| `bgm/bgm-battle.mp3` | 약 2분 57초 | 일반 전투·아레나 대전 |
| `bgm/bgm-boss.mp3` | 약 2분 57초 | 레이드·원정 보스 전투 |
| `bgm/bgm-shop.mp3` | 약 2분 29초 | 상점·프리미엄 상점 |

화면과 곡의 대응은 `src/core/bgmPlan.ts`의 `SCENE_TRACK` 한 표가 갖는다.

### 효과음

| 파일 | 생성 ID | 프롬프트 |
| --- | --- | --- |
| `ui/ui-click.mp3` | `4AAsZ1zyEBwYKL27Lkki` | Soft crisp mobile game UI button tap, short glassy click with a tiny bright digital tick, clean, no reverb |
| `ui/ui-tap.mp3` | `ysHLnZqQM4ib9nwnaZMo` | Very faint soft airy tick, tiny muted digital blip for tapping empty screen, subtle and gentle, close-mic, no reverb |
| `ui/ui-back.mp3` | `j1YsFOVGoSkFzXrCma0o` | Gentle muted mobile game back button, soft low dull thud like a felt-covered wooden tap, short and calm, rounded warm tone, no high pitch, no sparkle, no reverb |
| `ui/ui-tab.mp3` | `9BJNBrPOIN1tLt2YImGp` | Smooth soft sliding swish for switching tabs in a mobile game, airy paper-like whoosh gliding sideways, gentle and silky, quick fade out, no click, no reverb |
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
| `reward/roulette-tick.mp3` | `TzviVdqq8PYZjwAGQNzL` | Single crisp prize wheel peg tick, a short plastic flapper clicking against one peg, dry and bright, very short, no reverb |
| `reward/roulette-win.mp3` | `qrmlsdPiBaTAPzxHTwom` | Prize wheel stops on a winner, cheerful bright bell ding with a sparkly coin shimmer and short happy chime rise, cute mobile game reward |
| `reward/attendance-stamp.mp3` | `MHGn5yXgQbDG4xDxp7kI` | Heavy rubber stamp slammed down hard on a wooden desk, satisfying deep thump with a paper slap, punchy and solid, single hit |
| `reward/success-fanfare.mp3` | `IvrmtHv6Mhj97c7R7Eop` | Jackpot great success fanfare for a cute fantasy mobile game, short triumphant brass and bell flourish with sparkling coin shower and a cheerful final hit |
| `reward/success-count.mp3` | `DDOCAtt2rMK6LJZ7VZij` | Quick bright coin count tick, a single small gold coin clink with a tiny sparkle, very short, mobile game reward counter |
| `reward/mission-claim.mp3` | `813cefeIS8rh3Gq5Q5eN` | Mission reward claimed, satisfying bright collect chime, quick ascending three-note glassy ding with soft coin jingle, clean mobile game UI |
| `battle/sweep-scuffle.mp3` | `C3iY9VGGVhUJ3LMZ19LP` | Cartoon dust cloud brawl, comical rapid soft punches and bonks with whooshes inside a fight cloud, playful and light, no voices |
| `battle/sweep-blastoff.mp3` | `9As5oICh13RfwJ5JmcyO` | Cartoon character knocked flying into the sky, rising whistle whoosh that fades away ending in a tiny twinkling star ding, comical |
| `ui/rune-synth.mp3` | `baolaubXqCDrPe3TOoub` | Three magic gems being sucked into a glowing center, swirling crystalline whoosh building up quickly then a soft magical pop, fantasy crafting |
| `ui/relic-poke.mp3` | `VWQu8S584PHXUxrO5cpB` | Poking a soft squishy cute character's cheek, gentle bouncy jelly boing with a soft plush squish, round and warm, playful and short, mobile game, no voice, no reverb |
| `battle/sweep-hop.mp3` | `nC5wxS4KBVF5TsFHPusz` | Tiny cute character happy hop, short soft springy boing pop, light and bouncy, single hop, cartoon mobile game, no voice, no reverb |
| `ui/title-start.mp3` | `CuOlqyRhmMb27qQi0oR0` | Game start button, bright magical whoosh into a rich shimmering chime swell, inviting and grand |

| `battle/battle-block.mp3` | `MLW5mCeILLNkx7Vv7oHD` | Attack deflected with no effect, one short small metallic tink, clean and dry, game, no voice, no reverb |
| `battle/battle-stun.mp3` | `oHmu7RRjp15fLBKGNe6p` | Cartoon dizzy stun hit, short wobbly bonk followed by tiny twinkling stars circling, light and cute, game status effect, no voice, no reverb |
| `story/story-title-card.mp3` | `A43gdR5fh82wl0U5Ix7e` | Chapter title card fades in on a black screen, soft low warm swell resolving into a single gentle bell, calm and cinematic, no voice |
| `ui/formation-place.mp3` | `tVPmO2SY1PuZRBeO4h7X` | Character card placed into a team slot, one short soft solid snap thock with a tiny bright click, satisfying, mobile game UI, no voice, no reverb |
| `ui/ui-danger.mp3` | `LPEx4vkmwjGI704q22Hv` | Confirming an irreversible action, one short low dull muted thud, heavy and soft, serious, mobile game UI, no voice, no reverb |
| `battle/battle-sleep.mp3` | `6GP1ldYxgYT5hJH1Wzpm` | Cute character falling asleep, soft gentle descending airy chime like a tiny lullaby, dreamy and very short, mobile game, no voice, no snoring |
| `ui/settle-lift.mp3` | `Yj5wQsDBI4XKPBR2jZNv` | Dark cover lifting away to reveal rewards, soft airy upward whoosh with a gentle shimmer at the end, game UI, no voice |
| `ui/stamina-refill.mp3` | `Q1FjSsB1nQ1gAgaDog2B` | Energy refilled, quick rising bubbly fizz ending in a bright sparkly chime, refreshing energy drink, mobile game, no voice, no reverb |
| `ui/augment-lock.mp3` | `RDrNV1BnXN5UI2jPUzNp` | Glowing card snaps and locks into a slot, crisp snap with a short bright magical chime, game UI, no voice, no reverb |
| `battle/battle-death-clock.mp3` | `1Az7B2pLgrKLD58YVdbv` | Ominous warning, single deep low clock gong toll with a subtle tense ticking underneath, signals sudden death time starting, game, no voice |
| `ui/formation-lift.mp3` | `DSIyWu78xfpRe2Bij4AS` | Picking up a character card, one very short light airy swish lift, soft, mobile game UI, no voice, no reverb |
| `ui/equip-off.mp3` | `0bmfVmwWA7GccphgC0zW` | Removing a gem from a socket, one soft muted release click, short and gentle, game UI, no voice, no reverb |
| `ui/sell-coins.mp3` | `9xVWMR6XdTA4pmjS8YlK` | Selling an item, short clink of a few small stones and coins dropping into a pouch, crisp, mobile game UI, no voice, no reverb |
| `battle/battle-ult-ready.mp3` | `jCBPldSM9ytg84k1wH8H` | Short bright magical ready chime, quick ascending two-note sparkle ping, crisp and clean, signals a special skill is fully charged, mobile game UI, no voice, no reverb tail |
| `research/research-shatter.mp3` | `IyrRoTa2RST70wVdcE7G` | Small crystal card shattering into glittering shards, quick bright glass break with sparkles, mobile game, no voice, no reverb |
| `battle/battle-summon.mp3` | `1gjUpzMJczuDroTGIGvh` | Small magic poof as a little creature pops into the battlefield, soft puff of smoke with a tiny sparkle, short, cute game, no voice, no barking |
| `ui/equip-on.mp3` | `tYNne0hn6EG9hWQ0cXCE` | Socketing a gem rune into equipment, one short crisp metal clasp click with a tiny crystalline shine, game UI, no voice, no reverb |
| `battle/battle-shield-break.mp3` | `043vqjlym0dXup2Wo1pB` | Thin blue magical energy barrier shattering, brittle glassy crack and small tinkle of shards, short and light, fantasy game, no voice, no reverb |
| `battle/battle-wall-thud.mp3` | `9ESIGwfR8nvlrFUxLMuN` | Cartoon character body slamming flat into a wall, comedic soft "thwump" bonk, punchy cushioned impact with a tiny wooden knock, no voice, dry, single hit |
| `battle/battle-wall-tap.mp3` | `XBpuhJ3vNkbQ0YWXgRbN` | Small cartoon rubber ball bouncing off a wooden wall, short light "tak" tap, bright and bouncy, single quick hit, dry, no voice |
| `battle/battle-boing.mp3` | `aje9B0K5JWpXBcXbo6en` | Classic cartoon spring boing, comedic "doing-doing" wobbly jaw harp spring sound, playful, bright, short, no voice |

### 손질 기록 (v0.363.0)

- `battle-victory`·`battle-defeat`: 원본 테이크(위 생성 ID)를 1.35배속(음정 유지)으로 당기고 2.6초에서 0.7초 페이드로 끊었다. 결과판이 뜨는 순간에만 울린다.
- `ui-tap`: 원본 앞머리 0.24초의 잡음을 잘라 누른 순간 곧바로 울리게 했다. `ui-feed`: 두 번째 타격을 잘라 0.16초로 줄였다(꾹 누르면 85ms마다 먹인다). `ui-levelup`: 1.2배속·3.1초로 줄였다.
- `sweep-scuffle`: 먼지구름(1.1초)에 맞춰 0.87배속으로 늘였다.
- BGM 프롬프트(v0.363.0) — 타이틀: "Gentle, wistful instrumental theme of a girl riding a quiet train through a dreamy fantasy countryside, gazing out the window. Soft steady train-wheel rhythm on the rails as subtle brushed percussion, warm felt piano melody, mellow acoustic guitar, soft string pads, faint music box sparkle, slow relaxed tempo around 80 BPM ..." / 로비: "Soft, relaxing lo-fi style home theme for a cozy fantasy mobile game lobby. Slow tempo around 75 BPM, mellow electric piano and gentle nylon guitar ...". 옛 타이틀은 음량 폭(LRA)이 16.9 LU라 조용하다 크게 치솟았고, 새 두 곡은 2~3 LU다.
- `rune-fail`·`roulette-tick`·`ui-toggle`·`ui-unlock`·`dig-hit`·`research-crack`: 앞머리 무음 7~21ms를 걷어 냈다.


### 손질 기록 (v0.364.0)

- 위 18종(`battle-block` ~ `battle-shield-break`)은 화면 순간(막이 깨지는 프레임, 칸에 내려놓는 순간 등)에 맞춰 앞머리 무음을 걷고 길이를 0.13~1.4초로 끊었다. 테이크는 3개씩 뽑아 클리핑·피크 위치·스펙트럼 중심으로 골랐다.
- 새 파일 없이 기존 음원을 빌려 쓰는 큐: `story.hop`(대사 몸짓) = `sweep-hop` 작게, 넉백·대사 퇴장 = `sweep-blastoff`, 정산·수확·교류 귀환 = `ui-reward`, 순위 오르기 = `roulette-tick`.

### 손질 기록 (v0.365.0)

- `battle-wall-thud`·`battle-wall-tap`·`battle-boing`: 날려버림·쓰러진 몸이 전장 벽에 튕기는 순간용. 테이크 4개씩 뽑아 클리핑 없고 피크가 앞(5~30ms)에 선 것을 골랐고, 길이는 0.28~0.58초로 끊었다. 첫 부딪힘은 퍽(thud), 이어지는 튕김은 탁(tap), 세 번째마다 띠용(boing)으로 섞어 쓴다.
