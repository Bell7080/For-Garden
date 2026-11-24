import Phaser from "phaser";
import { t } from "../i18n";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import type { RuneInstance } from "../core/runes";
import { runeDisplayName, runeRarityLabel } from "../core/runes";
import { runeHolders } from "../core/runeLoadout";
import { RELICS } from "../data/relics";
import { session } from "../state/session";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { shapeClipMask } from "./popupArt";
import { addRuneFrame, RUNE_ACCENT, runeAccentCss } from "./runeIcons";
import { runeTraitName } from "./runeTraitPresentation";
import { openRuneInfoPopup } from "./RunePopup";
import { addScrollHint } from "./ScrollHint";
import { SortControl } from "./SortControl";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import {
  sortTraitBulkResult, TRAIT_BULK_RESULT, traitBulkGradeCounts, traitBulkResultRowAt, traitBulkResultRowY, traitBulkResultSize,
  type TraitBulkResultEntry, type TraitBulkResultSort,
} from "./runeTraitBulkResultLayout";

const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));
const RELIC_RANK = new Map(RELICS.map((relic, index) => [relic.id, index]));

/** 손이 이만큼 넘게 움직였으면 누른 것이 아니라 끈 것이다. */
/**
 * 누른 것으로 볼 흔들림. 휴대폰 손끝은 떼는 사이에도 몇 픽셀씩 밀리므로 14로 두면 줄을 눌러도 쪽지가
 * 열리지 않았다(응태 2026-11-24). 목록이 흐르지 않는 창에서는 끌어도 움직일 것이 없으니 더 넉넉히 받는다.
 */
const TAP_SLOP = TAP_DRAG_SLOP;
const TAP_SLOP_STILL = 64;

type ResultRow = TraitBulkResultEntry & { rune: RuneInstance };

/**
 * 특성 일괄 부여 결과 창 — 부여가 확정된 직후 일괄 부여 판 **위에** 겹쳐 뜬다.
 *
 * 머리줄이 몇 개에 붙었는지, 그 아래 칩 줄이 등급마다 몇 개인지를 말하고, 목록이 룬 하나에 한 줄씩
 * **룬 액자 · 붙은 특성(등급 색 + 이름) · 그 룬을 낀 렐릭**을 세운다(응태 2026-11-24 — 무엇이 어떻게 붙었고
 * 누가 끼고 있는지 한 번에). 줄을 누르면 그 룬의 쪽지가 열리고, 쪽지를 닫으면 장착이 바뀌었을 수 있으니 목록을
 * 다시 그린다. 정렬은 머리줄 오른쪽의 정렬 칩(등급순 · 장착자순 + 방향)이다 — 도감·룬 가방과 같은 한 장. 닫는 길은 판 밖 우하단 돌아가기와 판 밖 누르기뿐이다.
 *
 * 값은 서버가 돌려준 룬(`granted`)이고, 장착자와 최신 룬은 그릴 때마다 `session`에서 다시 읽는다.
 */
export function openRuneTraitBulkResultPopup(scene: Phaser.Scene, popups: PopupLayer, granted: readonly RuneInstance[], onClose?: () => void): void {
  const L = TRAIT_BULK_RESULT;
  if (granted.length === 0) return;
  const size = traitBulkResultSize(granted.length);
  const width = L.width;
  const height = size.height;
  const half = height / 2;
  const inner = width - L.padding * 2;
  const left = -width / 2 + L.padding;
  let sort: TraitBulkResultSort = "grade";
  let descending = true;

  const readRows = (): ResultRow[] => {
    const holders = runeHolders(session.relicProgress);
    return granted.map((given) => {
      const rune = session.runeInventory.find(({ instanceId }) => instanceId === given.instanceId) ?? given;
      const trait = rune.trait ?? given.trait;
      return { rune, instanceId: rune.instanceId, rarity: rune.rarity, traitGrade: trait?.grade ?? "uncommon", holderId: holders.get(rune.instanceId) };
    });
  };

  popups.open({ width, height, title: t("rune.traitBulk.result.title"), dim: true, closeOnBackdrop: true, onClose }, (body) => {
    // 머리줄 — 「룬 12개에 특성 부여」.
    const headline = scene.add.text(left, -half + L.headlineY, t("rune.traitBulk.result.headline", { count: granted.length.toLocaleString() }),
      textStyle({ role: "display", size: L.headlineSize, color: COLOR.ink })).setOrigin(0, 0.5);
    body.add(shrinkTextToWidth(headline, inner - L.sort.width - L.sort.gap - L.sort.dirWidth - 24));

    // 등급 칩 줄 — 높은 등급부터, 등급 색 글자 + 같은 색으로 물든 깎인 칩.
    let chipX = left;
    for (const { grade, count } of traitBulkGradeCounts(readRows())) {
      const label = scene.add.text(0, 0, t("rune.traitBulk.result.gradeCount", { grade: runeRarityLabel(grade), count: count.toLocaleString() }),
        textStyle({ role: "emphasis", size: L.chip.size, color: runeAccentCss(grade) })).setOrigin(0.5);
      const chipWidth = label.width + L.chip.padX * 2;
      const shape = chipPoints(chipWidth, L.chip.height, { bevel: { topLeft: L.chip.height * 0.32, topRight: 0, bottomRight: L.chip.height * 0.32, bottomLeft: 0 } });
      const y = -half + L.chipsY;
      body.add(drawLayer(scene, chipX + chipWidth / 2, y, shape, { fill: RUNE_ACCENT[grade], alpha: 0.16, edge: RUNE_ACCENT[grade], edgeAlpha: 0.8 }));
      label.setPosition(chipX + chipWidth / 2, y);
      body.add(label);
      chipX += chipWidth + L.chip.gap;
    }

    // 흐르는 목록 창. 마스크와 입력면은 흐르지 않는 틀을 따라간다.
    const frame = scene.add.container(0, -half + L.viewportTop);
    body.add(frame);
    const clipHalf = inner / 2 + 12;
    const content = scene.add.container(0, 0);
    frame.add(content);
    content.setMask(shapeClipMask(scene, frame, [-clipHalf, 0, clipHalf, 0, clipHalf, size.viewHeight, -clipHalf, size.viewHeight]));

    let rows: ResultRow[] = [];
    let nodes: Phaser.GameObjects.Container[] = [];
    let scroll = 0;
    const minScroll = Math.min(0, size.viewHeight - size.contentHeight);
    const apply = (value: number): void => {
      if (!content.active) return;
      scroll = Phaser.Math.Clamp(value, minScroll, 0);
      content.y = scroll;
      // 창 밖의 줄은 감춘다 — 마스크는 그림만 자르고, 백 줄을 늘 그리면 그만큼 무겁다.
      nodes.forEach((node, index) => {
        const top = traitBulkResultRowY(index) + scroll - L.row.height / 2;
        node.setVisible(top + L.row.height > 0 && top < size.viewHeight);
      });
    };

    const paintRows = (): void => {
      if (!content.active) return;
      rows = sortTraitBulkResult(readRows(), sort, RELIC_RANK, descending);
      // 새 줄을 먼저 세우고 옛 줄을 걷는다 — 얼굴 원화는 세운 객체가 사는 동안만 붙잡힌다.
      const fresh = rows.map((row, index) => {
        const node = addResultRow(scene, inner, row);
        node.setY(traitBulkResultRowY(index));
        content.add(node);
        return node;
      });
      nodes.forEach((node) => node.destroy());
      nodes = fresh;
      apply(scroll);
    };
    paintRows();

    // 끌면 흐르고, 거의 움직이지 않고 떼면 그 줄의 쪽지를 연다.
    const clip = (): ClipRect => {
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      return { left: matrix.tx - clipHalf * scale, right: matrix.tx + clipHalf * scale, top: matrix.ty, bottom: matrix.ty + size.viewHeight * scale };
    };
    const hit = addClippedHit(scene, frame, 0, size.viewHeight / 2, clipHalf * 2, size.viewHeight, clip, { useHandCursor: true });
    scene.input.setDraggable(hit);
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let moved = 0;
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { downX = pointer.x; downY = pointer.y; moved = 0; });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => {
      moved = Math.max(moved, Math.hypot(pointer.x - downX, pointer.y - downY));
      if (size.contentHeight <= size.viewHeight) return;
      const scale = frame.getWorldTransformMatrix().scaleY || 1;
      apply(scroll + (pointer.y - lastY) / scale);
      lastY = pointer.y;
    });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => apply(scroll - dy * 0.65));
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!popups.isTop(body)) return;
      const slop = size.contentHeight > size.viewHeight ? TAP_SLOP : TAP_SLOP_STILL;
      if (Math.max(moved, Math.hypot(pointer.x - downX, pointer.y - downY)) > slop) return;
      const matrix = frame.getWorldTransformMatrix();
      const scale = matrix.scaleY || 1;
      const index = traitBulkResultRowAt((pointer.y - matrix.ty) / scale - scroll, rows.length);
      const row = index === undefined ? undefined : rows[index];
      if (!row) return;
      openRuneInfoPopup(scene, popups, { runeInstanceId: row.instanceId, onClose: () => paintRows() });
    });
    if (size.contentHeight > size.viewHeight) {
      addScrollHint(scene, frame, { x: 0, y: size.viewHeight / 2, width: clipHalf * 2, height: size.viewHeight, owner: content, read: () => ({ offset: scroll, min: minScroll }) });
    }

    // 정렬 칩 — 머리줄 오른쪽 끝. 펼친 목록이 흐르는 줄 위에 앉도록 목록보다 나중에 세운다.
    const S = L.sort;
    const right = width / 2 - L.padding;
    new SortControl<TraitBulkResultSort>(scene, {
      x: right - S.dirWidth - S.gap - S.width / 2, y: -half + L.headlineY, height: S.height,
      sortWidth: S.width, dirWidth: S.dirWidth, gap: S.gap, fontSize: S.size, parent: body,
      sortOptions: [
        { id: "grade", label: t("rune.traitBulk.result.sortGrade") },
        { id: "holder", label: t("rune.traitBulk.result.sortHolder") },
      ],
      sortMode: sort, descending,
      onSort: (mode) => { if (sort === mode) return; sort = mode; scroll = 0; paintRows(); },
      onDirection: (value) => { descending = value; scroll = 0; paintRows(); },
    });
  });
}

/** 줄 하나 — 룬 액자 · 「전설 특성이름」/「1번 룬 · 영웅」 ··· 낀 렐릭(얼굴 + 이름) 또는 「장착 안 함」. */
function addResultRow(scene: Phaser.Scene, width: number, row: ResultRow): Phaser.GameObjects.Container {
  const L = TRAIT_BULK_RESULT.row;
  const node = scene.add.container(0, 0);
  const grade = row.traitGrade;
  const accent = RUNE_ACCENT[grade];
  const shape = chipPoints(width, L.height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
  node.add(drawLayer(scene, 0, 0, shape, { fill: accent, alpha: 0.1, edge: accent, edgeAlpha: 0.6 }));
  node.add(drawLayer(scene, 0, 0, shape, { fill: 0x121a24, alpha: HOLO.glass }));
  node.add(scene.add.rectangle(-width / 2 + 14 + L.band / 2, 0, L.band, L.height - 30, accent, 0.95));

  const rune = row.rune;
  const frameX = -width / 2 + 36 + L.frame / 2;
  node.add(addRuneFrame(scene, frameX, 0, L.frame, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));

  const right = width / 2 - 24;
  const holderLeft = right - L.holderWidth;
  const holder = row.holderId ? RELIC_BY_ID.get(row.holderId) : undefined;
  if (holder) {
    node.add(new FaceFrame(scene, holderLeft + L.face / 2, 0, { portraitAssetId: holder.portraitAssetId, size: L.face, color: COLOR.accent }));
    const name = scene.add.text(holderLeft + L.face + 14, 0, holder.name, textStyle({ role: "emphasis", size: L.holderSize, color: COLOR.accentText })).setOrigin(0, 0.5);
    shrinkTextToWidth(name, right - (holderLeft + L.face + 14));
    node.add(name);
  } else {
    const none = scene.add.text(holderLeft + L.holderWidth / 2, 0, t("rune.notEquipped"), textStyle({ role: "body", size: L.holderSize, color: COLOR.inkDim })).setOrigin(0.5);
    shrinkTextToWidth(none, L.holderWidth);
    node.add(none);
  }
  // 글 기둥과 장착자 기둥 사이의 얇은 구분선.
  node.add(scene.add.rectangle(holderLeft - 18, 0, 2, L.height * 0.5, 0xffffff, 0.14));

  const textX = frameX + L.frame / 2 + 22;
  const textRoom = holderLeft - 36 - textX;
  const gradeText = scene.add.text(textX, -18, runeRarityLabel(grade), textStyle({ role: "display", size: L.gradeSize, color: runeAccentCss(grade) }))
    .setOrigin(0, 0.5).setShadow(0, 3, "#000000", 4, false, true);
  node.add(gradeText);
  const traitName = rune.trait ? runeTraitName(rune.trait.id) : "";
  const nameText = scene.add.text(textX + gradeText.width + 14, -18, traitName, textStyle({ role: "display", size: L.nameSize, color: COLOR.ink })).setOrigin(0, 0.5);
  shrinkTextToWidth(nameText, Math.max(60, textRoom - gradeText.width - 14));
  node.add(nameText);
  const sub = scene.add.text(textX, 24, `${runeDisplayName(rune)}  ·  ${runeRarityLabel(rune.rarity)}`, textStyle({ role: "body", size: L.subSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
  squeezeTextToWidth(sub, textRoom);
  node.add(sub);
  return node;
}
