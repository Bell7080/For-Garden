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
export type AnchorKind = "core" | "head";

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

/** 관절을 찾지 못한 묶음을 위한 대체 기준점. 코어는 상자 중앙, 머리는 상자 위쪽이다. */
function fallbackAnchor(frame: AnchorFrame, kind: AnchorKind): AnchorPoint {
  const x = (frame.content.left + frame.content.right) / 2;
  const height = frame.content.bottom - frame.content.top;
  return { x, y: frame.content.top + height * (kind === "core" ? 0.5 : 0.12) };
}

/** 배치에 바로 쓸 수 있도록 코어·머리 기준점을 한 번에 해석한다. */
export function resolveAnchors(
  bones: readonly PuppetBone[],
  frame: AnchorFrame,
): Record<AnchorKind, AnchorPoint> {
  const pick = (kind: AnchorKind): AnchorPoint => {
    const bone = findAnchorBone(bones, kind);
    return bone ? { x: bone.x, y: bone.y } : fallbackAnchor(frame, kind);
  };
  return { core: pick("core"), head: pick("head") };
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
  const cropY = clamp(frame.content.top + (head.y - frame.content.top) * headroom, frame.imageHeight - cropHeight);

  return { cropX, cropY, cropWidth, cropHeight, scale };
}
