import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { registerDialogueTexts } from "./registerDialogue";

/*
 * **1장 오프닝 — 추락하는 방주.**
 *
 * `docs/lore.md` §6의 수송 열차 피습을 그대로 무대에 올린다. 이터널 시티로 향하는 열차 안에서
 * 호위를 맡은 쁘띠 로그 셋(토리카·도디·파루아)이 연구원을 처음 만나고, 경보와 함께 검은 베일을
 * 쓴 공멸의 선봉(코마)이 연구원을 산 채로 데려가는 **목표 회수** 작전을 선언한 뒤 열차가 폭파된다. 부서진 선로 위에서 공멸의 우당탕탕
 * 삼인조(토비·아모·리파)가 연구원을 노리고 달려드는 데서 끝나 **곧바로 1-1로 이어진다** —
 * 1-1의 적 편성이 바로 이 셋이고, 그 관문의 상황 한 줄이 「불타는 객차에서 빠져나왔다」다.
 *
 * 쁘띠 로그가 연구원을 부르는 말(`대장님`)은 `src/data/factions.ts`의 호칭 그대로이며, 처음에는
 * `연구원님`으로 부르다가 도디가 붙인 그 호칭을 토리카가 마지막 대답에서 받아들인다.
 *
 * 표정은 적지 않는다. 스탠딩은 늘 idle로 서 있고 기분은 `act`(통통·부들부들·끄덕)가 말한다.
 */

/** 열차 안 쁘띠 로그 셋의 자리. 말하는 사람만 바뀌므로 한 번 정해 두고 되풀이해 쓴다. */
const ROGUE_TRIO: readonly DialogueCastMember[] = [
  { id: "dodi", slot: "left" },
  { id: "torika", slot: "center" },
  { id: "parua", slot: "right" },
];

/** 공멸 삼인조. 앞에 서는 토비가 가운데, 뒤를 막는 아모와 숨어 있던 리파가 양옆이다. */
const RAID_TRIO: readonly DialogueCastMember[] = [
  { id: "amo", slot: "left" },
  { id: "toby", slot: "center" },
  { id: "ripa", slot: "right" },
];

/** 오프닝의 문장과 분기는 씬에서 분리해 번역·검수와 회상 재사용이 가능하게 둔다. */
export const OPENING_TRAIN: DialogueStory = {
  id: "opening-train",
  startNodeId: "wake",
  backdrop: "train",
  titleCard: { title: "추락하는 방주", subtitle: "이터널 시티와 연구원" },
  nodes: [
    // ── 열차 안: 토리카 ───────────────────────────────────────────────
    { id: "wake", speaker: "???", body: "연구원님, 연구원님! 눈 좀 떠 보세요. 창밖에 도시가 보여요!", standing: "torika", cast: [{ id: "torika", slot: "center" }], act: "hop", nextId: "greet" },
    { id: "greet", speaker: "토리카", body: "저는 토리카예요! 오늘부터 연구원님을 지키는 호위 렐릭이에요. 도착할 때까지 옆에 꼭 붙어 있을게요.", standing: "torika", act: "nod", nextId: "window" },
    { id: "window", speaker: "토리카", body: "저기, 하얀 뼈처럼 솟은 탑들 보이세요? 멸종의 기억 위에 세운 도시, 이터널 시티예요.", standing: "torika", act: "lean", nextId: "answer" },
    {
      id: "answer", speaker: "토리카", body: "도착하면 제일 먼저 뭘 하고 싶으세요?", standing: "torika",
      choices: [
        { id: "promise", label: "너희를 더 알고 싶어", nextId: "warm", effect: { type: "bondXp", relicId: "anky", amount: 5 } },
        { id: "work", label: "도시부터 둘러볼게", nextId: "ready" },
      ],
    },
    { id: "warm", speaker: "토리카", body: "헤헤, 그럼 저부터 알려 드릴게요! 좋아하는 건 간식이랑… 연구원님 옆자리요!", standing: "torika", act: "hopTwice", nextId: "peek" },
    { id: "ready", speaker: "토리카", body: "그럼 제가 안내할게요! 맛있는 가게부터… 아, 아니, 중요한 연구소부터요!", standing: "torika", act: "shake", nextId: "peek" },

    // ── 도디: 부끄럽지만 반짝반짝한 1호 팬 ──────────────────────────────
    { id: "peek", speaker: "???", body: "저, 저기… 토리카. 혹시 그분이… 그 연구원님이야?", standing: "dodi", cast: [{ id: "dodi", slot: "left" }, { id: "torika", slot: "right" }], act: "tremble", nextId: "callDodi" },
    { id: "callDodi", speaker: "토리카", body: "도디! 뒤에 숨어 있지 말고 나와서 인사해야지!", standing: "torika", act: "hop", nextId: "fan" },
    { id: "fan", speaker: "도디", body: "와아… 진짜다. 진짜 연구원님이다! 저, 저는 기록병 도디예요! 연구원님이 쓰신 복원 보고서는 한 줄도 빼놓지 않고 다 읽었어요!", standing: "dodi", act: "hopTwice", nextId: "shy" },
    { id: "shy", speaker: "도디", body: "그, 그러니까… 제 일지 첫 장에… 이름 한 번만 적어 주시면 안 될까요…?", standing: "dodi", act: "shrink", nextId: "title" },
    { id: "title", speaker: "도디", body: "오늘부터 연구원님은 저희 대장님이에요! 대장님, 대장님… 헤헤, 벌써 입에 붙었어요!", standing: "dodi", act: "hop", nextId: "halt" },

    // ── 파루아: 도디를 붙잡으며 연구원에게 흥미를 ───────────────────────
    { id: "halt", speaker: "???", body: "도디. 너무 가까워. 연구원님이 뒤로 기울어지고 있어.", standing: "parua", cast: ROGUE_TRIO, act: "lean", nextId: "sorry" },
    { id: "sorry", speaker: "도디", body: "앗, 죄, 죄송해요! 너무 반가워서 그만…!", standing: "dodi", act: "recoil", nextId: "parua" },
    { id: "parua", speaker: "파루아", body: "…파루아. 뒤를 살피는 게 내 일이야.", standing: "parua", act: "nod", nextId: "sniff" },
    { id: "sniff", speaker: "파루아", body: "그런데 이상해. 연구원님한테서는 다른 연구원들이랑 다른 냄새가 나. …조금만 더 가까이 봐도 돼?", standing: "parua", act: "lean", nextId: "scold" },
    { id: "scold", speaker: "토리카", body: "파루아까지! 연구원님 곤란하시잖아!", standing: "torika", act: "shake", nextId: "quake" },

    // ── 경보: 큰 진동, 그리고 검은 베일 ───────────────────────────────
    { id: "quake", speaker: "", body: "쿠구구궁…!! 객차 전체가 크게 들썩인다.", cue: "rumble", nextId: "alarm" },
    { id: "alarm", speaker: "안내 방송", body: "경보. 경보. 선로 전방에 미확인 개체 접근. 승객 여러분은 즉시 자리를 지켜 주십시오.", cue: "alarm", nextId: "sense" },
    { id: "sense", speaker: "파루아", body: "…앞에서 뭔가 와. 하나가 아니야.", standing: "parua", act: "tremble", nextId: "guard" },
    { id: "guard", speaker: "토리카", body: "연구원님, 제 뒤로 오세요! 무슨 일이 있어도 제가 막을게요!", standing: "torika", act: "hop", nextId: "veil" },
    { id: "veil", speaker: "???", body: "찾았다. Garden이 내려보낸 연구원.", standing: "koma", cast: [{ id: "koma", slot: "center", veiled: true }], cue: "rumble", nextId: "order" },
    { id: "order", speaker: "???", body: "목표 회수 작전을 개시한다. 연구원은 산 채로 데려간다. …방주째로 떨어뜨려.", standing: "koma", act: "nod", nextId: "blast" },

    // ── 폭파: 열차에서 전장으로 ──────────────────────────────────────
    { id: "blast", speaker: "", body: "콰아아아앙!!", cast: [], cue: "explosion", backdrop: "battlefield", nextId: "aftermath" },
    { id: "aftermath", speaker: "토리카", body: "콜록, 콜록… 연구원님, 괜찮으세요?! 열차가… 선로 밖으로 떨어졌어요…!", standing: "torika", cast: [{ id: "torika", slot: "center" }], act: "shake", nextId: "record" },
    { id: "record", speaker: "도디", body: "대, 대장님은 무사해요! 기록… 기록해야 하는데… 아니, 지금은 그럴 때가 아니지!", standing: "dodi", cast: ROGUE_TRIO, act: "tremble", nextId: "three" },
    { id: "three", speaker: "파루아", body: "쉿. 셋이야. 연기 너머에서 이쪽으로 오고 있어.", standing: "parua", act: "lean", nextId: "toby" },

    // ── 공멸의 우당탕탕 삼인조 ──────────────────────────────────────
    { id: "toby", speaker: "토비", body: "찾았다아! 저기 있다, 그 연구원! 이번엔 내가 제일 먼저 잡는다!", standing: "toby", cast: RAID_TRIO, act: "hopTwice", cue: "impact", nextId: "amo" },
    { id: "amo", speaker: "아모", body: "토, 토비… 목소리 좀 줄여. 코마가 조용히 움직이랬잖아…", standing: "amo", act: "tremble", nextId: "ripa" },
    { id: "ripa", speaker: "리파", body: "에이, 어차피 다 들켰는걸? 저쪽 셋 표정 좀 봐. 완전 재밌다!", standing: "ripa", act: "hop", nextId: "demand" },
    { id: "demand", speaker: "토비", body: "우리는 공멸! 그 연구원만 넘기면 너희는 곱게 보내 줄게!", standing: "toby", act: "shake", nextId: "refuse" },

    // ── 맞서는 쁘띠 로그 ──────────────────────────────────────────
    { id: "refuse", speaker: "토리카", body: "싫어요! 연구원님은… 우리 대장님이에요. 한 발짝도 못 지나가요!", standing: "torika", cast: ROGUE_TRIO, act: "hop", cue: "impact", nextId: "brave" },
    { id: "brave", speaker: "도디", body: "무, 무섭지만… 대장님을 지킨 첫 기록은 제가 쓸 거예요!", standing: "dodi", act: "tremble", nextId: "aim" },
    { id: "aim", speaker: "파루아", body: "…화살은 준비됐어. 대장님, 신호만 줘.", standing: "parua", act: "nod", nextId: "command" },
    { id: "command", speaker: "연구원", body: "쁘띠 로그, 전투 개시!", cue: "impact", nextId: "end" },
    { id: "end", speaker: "토리카", body: "네, 대장님!", standing: "torika", act: "hop" },
  ],
};

registerDialogueTexts(OPENING_TRAIN);
