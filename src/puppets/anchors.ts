import type { PuppetBone } from "puppetforge";

/**
 * PuppetForge 관절 이름·태그로 "화면에서 기준으로 삼을 점"을 찾는다.
 *
 * 캐릭터마다 그림 안에서 서 있는 위치가 다르므로 이미지 상자나 발끝을 기준으로 확대하면
 * 얼굴이 화면 밖으로 나가거나 카드 아래로 내려간다. 대신 모든 묶음이 공통으로 가진
 * `중심1`(코어)과 `머리1`을 기준점으로 삼아 배치한다. Phaser에 의존하지 않는 순수 계산이라
 * 씬 없이 테스트할 수 있다.
 */

/** 화면 배치의 기준으로 쓰는 관절 종류. */
export type AnchorKind = "core" | "head" | "body";

/** placeholder도 전용 원화와 동일한 core/head/body 해석을 거쳐 교체 시 화면 좌표를 바꾸지 않는다. */
export const PLACEHOLDER_ANCHOR_KINDS: readonly AnchorKind[] = ["core", "head", "body"];

/** 텍스처(원본 이미지) 좌표계의 한 점. */
export interface AnchorPoint {
  x: number;
  y: number;
}

/** 그림이 실제로 그려진 영역. 투명 여백을 제외한 상자다. */
export interface ContentBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 이미지 크기와 내용 상자만 있으면 되는 배치용 최소 정보. */
export interface AnchorFrame {
  imageWidth: number;
  imageHeight: number;
  content: ContentBox;
}

interface AnchorRule {
  /** 반드시 가지고 있어야 하는 태그. 하나라도 있으면 후보다. */
  requiredTags: readonly string[];
  /** 얼굴 부속(눈·입)처럼 같은 태그를 공유하는 관절을 제외한다. */
  excludedTags: readonly string[];
  /** 태그가 비어 있는 예전 묶음을 위한 이름 규칙. */
  namePrefix: string;
}

const ANCHOR_RULES: Record<AnchorKind, AnchorRule> = {
  core: { requiredTags: ["core", "root"], excludedTags: [], namePrefix: "중심" },
  head: { requiredTags: ["head"], excludedTags: ["eye", "mouth", "hair", "cloth"], namePrefix: "머리" },
  body: { requiredTags: ["body"], excludedTags: ["root"], namePrefix: "몸통" },
};

function matches(bone: PuppetBone, rule: AnchorRule): boolean {
  const tags = bone.tags ?? [];
  if (rule.excludedTags.some((tag) => tags.includes(tag))) return false;
  return rule.requiredTags.some((tag) => tags.includes(tag));
}

/**
 * 기준 관절을 찾는다. 태그 → 이름 → (코어일 때만) 루트 관절 순으로 물러선다.
 * 셋 다 실패하면 `undefined`를 돌려주고, 호출부가 내용 상자로 대신 계산한다.
 */
export function findAnchorBone(bones: readonly PuppetBone[], kind: AnchorKind): PuppetBone | undefined {
  const rule = ANCHOR_RULES[kind];
  const tagged = bones.filter((bone) => matches(bone, rule));
  // 같은 태그를 여러 관절이 가지면 `중심1`·`머리1`처럼 1번 이름을 우선한다.
  const preferred = tagged.find((bone) => bone.name === `${rule.namePrefix}1`) ?? tagged[0];
  if (preferred) return preferred;

  const named = bones.find(
    (bone) => bone.name.startsWith(rule.namePrefix) && !rule.excludedTags.some((tag) => (bone.tags ?? []).includes(tag)),
  );
  if (named) return named;

  return kind === "core" ? bones.find((bone) => bone.parentId === null) : undefined;
}

/** 발 태그를 우선하고, 태그가 없는 구형 묶음은 `발1`·`발2` 이름으로 찾는다. */
export function findGroundBones(bones: readonly PuppetBone[]): PuppetBone[] {
  const tagged = bones.filter((bone) => (bone.tags ?? []).some((tag) => tag === "foot" || tag === "ground"));
  return tagged.length > 0 ? tagged : bones.filter((bone) => bone.name.startsWith("발"));
}

/** 관절을 찾지 못한 묶음을 위한 대체 기준점. 코어는 상자 중앙, 머리는 상자 위쪽이다. */
function fallbackAnchor(frame: AnchorFrame, kind: AnchorKind): AnchorPoint {
  const x = (frame.content.left + frame.content.right) / 2;
  const height = frame.content.bottom - frame.content.top;
  // 몸통은 코어보다 조금 위에 두어, 관절 정보가 적은 구형 묶음도 자연스러운 순서를 유지한다.
  const ratio = kind === "head" ? 0.12 : kind === "body" ? 0.38 : 0.5;
  return { x, y: frame.content.top + height * ratio };
}

/** 배치에 바로 쓸 수 있도록 코어·머리·몸통 기준점을 한 번에 해석한다. */
export function resolveAnchors(
  bones: readonly PuppetBone[],
  frame: AnchorFrame,
): Record<AnchorKind, AnchorPoint> {
  const pick = (kind: AnchorKind): AnchorPoint => {
    const bone = findAnchorBone(bones, kind);
    return bone ? { x: bone.x, y: bone.y } : fallbackAnchor(frame, kind);
  };
  return { core: pick("core"), head: pick("head"), body: pick("body") };
}

/** 기준 관절을 화면의 한 점에 맞출 때 쓰는 설정. */
export interface FocusOptions {
  /** 기준 관절이 놓일 화면 좌표. */
  x: number;
  y: number;
  /** 그림(투명 여백 제외) 전체가 화면에서 가지는 높이. 화면 밖으로 잘려도 된다. */
  height: number;
  flipX?: boolean;
}

/** Mesh에 그대로 넣는 좌표와 배율. */
export interface AnchoredPlacement {
  x: number;
  y: number;
  scale: number;
}

/**
 * 기준 관절이 `focus`에 오도록 Mesh 좌표를 구한다.
 *
 * Mesh 원점은 이미지 한가운데라, 이미지 안에서 기준점이 중앙으로부터 떨어진 만큼을
 * 배율에 맞춰 되돌려 놓아야 한다. 좌우 반전이면 가로 어긋남의 부호가 뒤집힌다.
 */
export function computeAnchoredPlacement(
  frame: AnchorFrame,
  anchor: AnchorPoint,
  options: FocusOptions,
): AnchoredPlacement {
  const scale = options.height / (frame.content.bottom - frame.content.top);
  const offsetX = (anchor.x - frame.imageWidth / 2) * scale * (options.flipX ? -1 : 1);
  const offsetY = (anchor.y - frame.imageHeight / 2) * scale;
  return { x: options.x - offsetX, y: options.y - offsetY, scale };
}

/** 카드 섬네일 한 장을 그리는 데 필요한 잘라내기 정보. */
export interface CardFrame {
  /** 원본 이미지에서 잘라낼 영역. Phaser `setCrop` 인자와 같은 순서다. */
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  scale: number;
  /**
   * 자르기 시작점이 그림의 맨 위(`content.top`)보다 아래로 내려갔는지.
   *
   * true면 원화의 정수리가 통째로 사라지고 그 단면이 수평선으로 남는다. 들어 올린 손처럼
   * 머리가 아닌 부위를 일부러 잘라 낼 때만 참이어야 하며, 평범한 전신 원화가 여기에 걸리면
   * 그건 카드가 머리를 자르고 있다는 뜻이다(`MAX_HEAD_DROP_RATIO` 주석 참고).
   */
  clipsContentTop: boolean;
}

export interface CardFrameOptions {
  width: number;
  height: number;
  /**
   * 카드 가로폭 대비 캐릭터 폭의 비율. 1보다 작을수록 크게 확대되어 좌우가 잘린다.
   * 니케 카드처럼 얼굴이 꽉 차 보이도록 기본값을 1보다 작게 둔다.
   */
  fillRatio?: number;
  /** 머리 관절 위쪽 여백을 얼마나 남길지. 0이면 머리 관절이 카드 맨 위에 붙는다. */
  headroom?: number;
}

/**
 * 자르기 상자 높이 대비, 머리 관절이 상단에서 최대로 내려갈 수 있는 비율.
 *
 * `headroom`은 "내용 상자 맨 위"와 "머리 관절" 사이에서 시작점을 고르는데, 들어 올린 손·망토·
 * 깃털처럼 **머리가 아닌** 부위가 머리보다 높이 솟아 있으면 내용 상자 맨 위가 머리에서 한참
 * 떨어진다. 그러면 자르기가 그 부위에서 시작해 머리는 카드 아래쪽이나 밖으로 밀려난다. 이
 * 비율은 그 경우에만 자르기 시작점을 아래로 더 내릴 수 있는 한계다.
 *
 * **이 한계가 걸리는 순간 정수리가 잘린다.** 시작점이 `content.top`보다 아래로 내려가므로
 * 원화의 맨 윗부분이 통째로 사라지고, 그 단면이 수평선으로 남아 머리가 평평하게 깎여 보인다
 * (v0.34.3까지 토리카·도디가 그랬다 — 0.34는 등신이 낮아 머리가 큰 원화에게는 너무 좁았다).
 * 그래서 값은 "실제 원화가 절대 닿지 않는" 자리에 둔다:
 *
 * | 원화 | 머리 위 여백 ÷ 자르기 높이 |
 * | --- | --- |
 * | 토리카 | 0.386 |
 * | 도디 | 0.383 |
 * | 메테 | 0.262 |
 * | 렉시아 | 0.251 |
 * | 스피나 | 0.287 |
 * | 루카 | 0.265 |
 *
 * 가장 큰 값이 0.39 언저리이므로 0.46은 그보다 확실히 위이고, 카드 절반(0.5)보다는 아래라
 * 진짜로 손을 들어 올린 포즈에서는 여전히 얼굴을 카드 상단 절반 안에 붙잡아 둔다. 새 원화를
 * 넣은 뒤 정수리가 평평하게 잘려 보이면 이 값을 조금씩 내리지 말고, 먼저
 * `tests/unit/puppetAnchors.test.ts`의 "실제 원화" 회귀 테스트에 그 원화를 더해 한계에
 * 걸리는지부터 확인한다 — 걸린다면 원인은 카드가 아니라 그 원화의 등신비다.
 */
const MAX_HEAD_DROP_RATIO = 0.46;

/**
 * 내용 상자 맨 위(`content.top`)에 자르기를 딱 붙이면(headroom 0) 뾰족하거나 갈래진 장식은
 * 자연스럽게 가늘어지며 사라져 눈에 띄지 않지만, 토리카의 뿔처럼 끝이 뭉툭·넓은 장식은 잘린
 * 단면이 그대로 수평선으로 남아 그리드 허용 범위 밖으로 넘친 것처럼 보인다. 모든 캐릭터에
 * 공통으로 아주 작은 여백을 얹어 정수리 위에 숨 쉴 틈을 만든다 — 캐릭터마다 다른 값을 주지
 * 않고 이 한 상수만 조정한다.
 */
const HEAD_TIP_MARGIN_RATIO = 0.035;

/**
 * 머리 관절이 카드 상단에 오도록 확대·잘라내기 값을 구한다.
 *
 * 전신 원화를 카드 비율에 그대로 넣으면 얼굴이 손톱만 해지므로, 얼굴이 보이는 상단부만
 * 남기고 좌우·아래를 잘라낸다. 잘라내기 상자는 항상 이미지 안에 머문다.
 */
export function computeHeadCardFrame(
  frame: AnchorFrame,
  head: AnchorPoint,
  options: CardFrameOptions,
): CardFrame {
  const contentWidth = frame.content.right - frame.content.left;
  const fillRatio = options.fillRatio ?? 0.74;
  const headroom = options.headroom ?? 0.22;

  const scale = options.width / (contentWidth * fillRatio);
  const cropWidth = Math.min(options.width / scale, frame.imageWidth);
  const cropHeight = Math.min(options.height / scale, frame.imageHeight);

  const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), Math.max(max, 0));
  const cropX = clamp(head.x - cropWidth / 2, frame.imageWidth - cropWidth);
  // 머리카락 끝(내용 상자 위)과 머리 관절 사이에서 시작점을 잡아 정수리가 살짝 잘리게 한다.
  // 그 위에 공통 여백을 더 얹어, 뭉툭한 장식이 자르기 상단에 딱 붙어 수평으로 잘리지 않게 한다.
  const naturalCropY = frame.content.top + (head.y - frame.content.top) * headroom - cropHeight * HEAD_TIP_MARGIN_RATIO;
  // 자연스러운 시작점이 머리를 상단 한계 밖으로 밀어내면(위 주석 참고) 그만큼만 시작점을
  // 늦춘다 — 정상 원화의 결과보다 시작점을 앞당기지는 않는다.
  const cropY = clamp(Math.max(naturalCropY, head.y - cropHeight * MAX_HEAD_DROP_RATIO), frame.imageHeight - cropHeight);

  return { cropX, cropY, cropWidth, cropHeight, scale, clipsContentTop: cropY > frame.content.top };
}
