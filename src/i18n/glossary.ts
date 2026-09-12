/**
 * 게임 용어 사전.
 *
 * 문구를 파일마다 옮기면 **같은 말이 화면마다 다르게 번역된다.** 6만 자를 138개 파일에서
 * 옮기는 동안 `렐릭`이 어디서는 `レリック`, 어디서는 `遺物`이 되면 플레이어는 두 가지가 있는
 * 줄 안다. 그래서 개체·재화·시스템의 이름은 이 표 하나가 언어별로 못 박고,
 * `tests/unit/glossary.test.ts`가 번역 표를 훑어 어긋난 자리를 잡는다.
 *
 * **전투 규칙어는 여기 두지 않는다.** 출혈·기절·경직처럼 설명문에서 `[[id|표기]]`로 가리키는
 * 말은 이미 `src/data/keywords.ts`가 ID와 함께 갖고 있다. 이 표가 맡는 것은 그 밖의
 * 시스템 이름 — 화면 이름, 재화, 성장 조작, 콘텐츠 이름이다.
 *
 * `note`는 번역할 때 읽는 설명이다. **낱말만 보고 옮기면 틀리는 말이 많다** — `발굴`은 캐릭터를
 * 뽑는 일이 아니라 배치해 두고 자원을 걷는 방치형이고, `연구`가 뽑기다.
 */

import type { LanguageId } from "../core/language";

export interface GlossaryTerm {
  /** 이 말이 무엇을 가리키는지. 번역 전에 반드시 읽는다. */
  note: string;
  /**
   * 언어별 표기. 한국어가 원본이다.
   *
   * **굴절하는 언어는 어간을 적는다.** 영어의 `급여`는 화면에서 `Feed`·`Feeding`으로 모두 서므로
   * 표기를 `Feed`로 두고, 검사가 대소문자를 무시한 어간으로 맞춘다(`Restore` → `Restoration`도
   * 같은 어간이다). 한 낱말이 다른 낱말을 품는 자리도 이 표가 푼다 — 한국어 `연구소`는 `연구`를
   * 품으므로, 영어 표기를 `Research Lab`으로 두어 두 검사를 함께 만족시킨다.
   */
  forms: { ko: string } & Partial<Record<LanguageId, string>>;
}

export const GLOSSARY = {
  // ── 개체 ──────────────────────────────────────────────────────────────
  relic: { note: "복원한 멸종 동물 개체. 플레이어가 모으고 키우는 캐릭터의 공식 명칭이다.", forms: { ko: "렐릭", ja: "レリック", en: "Relic" } },
  specimen: { note: "관찰 일지 상단의 표본 메타데이터. 개체를 연구 대상으로 부를 때 쓴다.", forms: { ko: "표본", ja: "標本", en: "specimen" } },
  restoration: { note: "화석에서 개체를 되살리는 일. 세계관의 핵심 동사라 임의로 바꾸지 않는다.", forms: { ko: "복원", ja: "復元", en: "Restore" } },
  squad: { note: "5대 자치 스쿼드. 개체의 소속이며 조직 이름이지 편성이 아니다.", forms: { ko: "스쿼드", ja: "スクワッド", en: "Squad" } },

  // ── 성장 ──────────────────────────────────────────────────────────────
  bond: { note: "개체별 관계 수치. 획득·승리·일일 상호작용으로 오른다. 애착과 다르다.", forms: { ko: "유대", ja: "絆", en: "Bond" } },
  favorite: { note: "로비에 세울 대표 개체 하나. 유대 수치를 바꾸지 않는다.", forms: { ko: "애착", ja: "お気に入り", en: "Favorite" } },
  bookmark: { note: "목록을 추리는 표식. 여럿을 고를 수 있고 애착과 별개다.", forms: { ko: "즐겨찾기", ja: "ブックマーク", en: "Bookmark" } },
  breakthrough: { note: "파편으로 별을 올려 레벨 상한을 여는 일. 각성과 다른 축이다.", forms: { ko: "한계 돌파", ja: "限界突破", en: "Breakthrough" } },
  awakening: { note: "0~5단계의 별도 성장축. 한계 돌파와 섞지 않는다.", forms: { ko: "각성", ja: "覚醒", en: "Awaken" } },
  feeding: { note: "치즈케이크를 먹여 경험치를 올리는 일. 레벨업 버튼이 아니라 급여다.", forms: { ko: "급여", ja: "給餌", en: "Feed" } },
  fragment: { note: "같은 개체를 다시 만나 쌓이는 그 개체 전용 조각. 한계 돌파에 쓴다.", forms: { ko: "파편", ja: "欠片", en: "Shard" } },

  // ── 룬 ────────────────────────────────────────────────────────────────
  rune: { note: "하트를 셋으로 자른 조각 장비. 자기 자리 번호를 갖고 나온다.", forms: { ko: "룬", ja: "ルーン", en: "Rune" } },
  runecraft: { note: "골드를 써서 룬의 옵션을 올리는 되돌릴 수 없는 조작.", forms: { ko: "세공", ja: "研磨", en: "Polish" } },
  engrave: { note: "세공을 마친 룬에 마지막으로 한 번 새기는 확정 강화.", forms: { ko: "각인", ja: "刻印", en: "Engrave" } },

  // ── 콘텐츠 ────────────────────────────────────────────────────────────
  research: { note: "화석·호박석을 써서 개체를 얻는 확률형 뽑기. **이것이 가챠다.**", forms: { ko: "연구", ja: "研究", en: "Research" } },
  lab: { note: "연구를 여는 화면 이름.", forms: { ko: "연구소", ja: "研究所", en: "Research Lab" } },
  excavation: { note: "로비에서 개체를 배치해 두고 시간이 지나 자원을 걷는 방치형. **뽑기가 아니다.**", forms: { ko: "발굴", ja: "採掘", en: "Excavation" } },
  expedition: { note: "수장된 제2·제3지부를 무대로 하는 주간 기록형 콘텐츠.", forms: { ko: "원정", ja: "遠征", en: "Expedition" } },
  interaction: { note: "이터널 바깥 Garden 도시들을 도는 방치형 서브 콘텐츠.", forms: { ko: "교류", ja: "交流", en: "Exchange" } },
  archaeology: { note: "하단 탭 첫 슬롯의 장기 탐사. 로비 왼쪽의 발굴과 다른 콘텐츠다.", forms: { ko: "고고학", ja: "考古学", en: "Archaeology" } },
  trade: { note: "젬으로 운영 패키지를 사는 전시대. 재화를 재화로 바꾸는 교환소가 아니다.", forms: { ko: "무역", ja: "商取引", en: "Trade" } },
  collection: { note: "보유·미보유를 갈라 보여 주는 개체 목록 화면.", forms: { ko: "도감", ja: "図鑑", en: "Archive" } },
  journal: { note: "개체의 표본 기록과 복원 후 관찰을 담은 쪽지.", forms: { ko: "관찰 일지", ja: "観察日誌", en: "Observation Log" } },

  // ── 재화 ──────────────────────────────────────────────────────────────
  stamina: { note: "출격에 드는 회복형 자원.", forms: { ko: "스테미나", ja: "スタミナ", en: "Stamina" } },
  gold: { note: "가장 흔한 재화. 세공에 쓴다.", forms: { ko: "골드", ja: "ゴールド", en: "Gold" } },
  gem: { note: "무역 전시대의 값을 치르는 재화.", forms: { ko: "젬", ja: "ジェム", en: "Gem" } },
  diamond: { note: "유료 축의 재화.", forms: { ko: "다이아", ja: "ダイヤ", en: "Diamond" } },
  fossil: { note: "연구에 넣는 뽑기 재화.", forms: { ko: "화석", ja: "化石", en: "Fossil" } },
  amber: { note: "화석보다 귀한 연구 재화.", forms: { ko: "호박석", ja: "琥珀", en: "Amber" } },
  cheesecake: { note: "급여에 쓰는 경험치 아이템.", forms: { ko: "치즈케이크", ja: "チーズケーキ", en: "Cheesecake" } },
  mileage: { note: "별 다섯에 닿은 뒤의 중복이 바뀌는 공용 교환 재화.", forms: { ko: "DNA 조각", ja: "DNA片", en: "DNA Shard" } },

  // ── 전투 ──────────────────────────────────────────────────────────────
  formation: { note: "세 자리에 개체를 세우는 일. 스쿼드(소속)와 다르다.", forms: { ko: "편성", ja: "編成", en: "Formation" } },
  combatPower: { note: "능력치 오각형의 넓이. 표시와 정렬에만 쓰고 전투 계산에는 쓰지 않는다.", forms: { ko: "전투력", ja: "戦闘力", en: "Combat Power" } },
  battleSpeed: { note: "전투 진행 배율 1·2·3. 칩에 `2배속`처럼 수와 붙어 서므로 짧은 표기를 쓴다.", forms: { ko: "배속", ja: "倍速", en: "Speed" } },
  ultimate: { note: "게이지가 차면 쓰는 큰 기술.", forms: { ko: "궁극기", ja: "必殺技", en: "Ultimate" } },
  passive: { note: "항상 도는 개체 고유 효과.", forms: { ko: "패시브", ja: "パッシブ", en: "Passive" } },
  frenzy: { note: "야성 게이지가 가득 차 시작되는 강화 상태. 벌이 아니라 상이다.", forms: { ko: "폭주", ja: "暴走", en: "Frenzy" } },
  augment: { note: "원정 런에서 고르는 일시 강화.", forms: { ko: "증강", ja: "オーグメント", en: "Augment" } },

  // ── 운영 ──────────────────────────────────────────────────────────────
  mission: { note: "일일·주간 달성 목록.", forms: { ko: "임무", ja: "ミッション", en: "Mission" } },
  mail: { note: "보상을 받는 우편함.", forms: { ko: "우편", ja: "メール", en: "Mail" } },
  shop: { note: "재화로 물건을 사는 화면.", forms: { ko: "상점", ja: "ショップ", en: "Shop" } },
  character: { note: "개체를 세계관 밖의 말로 부를 때. 화면 문구에서는 되도록 렐릭을 쓴다.", forms: { ko: "캐릭터", ja: "キャラクター", en: "Character" } },
} as const satisfies Record<string, GlossaryTerm>;

export type GlossaryId = keyof typeof GLOSSARY;

/** 그 언어로 못 박은 표기. 아직 정하지 않은 언어는 `undefined`다. */
export function glossaryForm(id: GlossaryId, language: LanguageId): string | undefined {
  const forms = GLOSSARY[id].forms as Record<string, string | undefined>;
  return forms[language];
}

/**
 * 사전 검사를 건너뛰는 자리와 그 이유.
 *
 * 한국어 낱말 하나가 두 가지를 가리키는 자리가 있다. `발굴`이 그렇다 — 게임의 방치형 자원
 * 수집 기능이기도 하고, 화석을 땅에서 캐낸 실제 행위이기도 하다. 두 뜻은 다른 언어에서 다른
 * 말이 되므로, 기능이 아닌 쪽은 여기 적어 검사에서 뺀다.
 *
 * **비우려고 적지 않는다.** 새로 더할 때는 왜 사전의 표기를 쓰면 안 되는지를 주석으로 남긴다.
 */
export const GLOSSARY_EXCEPTIONS: Readonly<Record<string, readonly GlossaryId[]>> = {
  // 화석을 캐낸 실제 장소이지 방치형 자원 수집 기능이 아니다.
  "info.journal.site": ["excavation"],
  // 아직 화석에서 복원하지 않은 개체라는 뜻이다.
  "info.enemy.undug": ["excavation"],
};
