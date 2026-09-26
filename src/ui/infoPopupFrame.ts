import Phaser from "phaser";
import { setDebugInfoAssetReady } from "../debug";
import { addPopupBackgroundImage, BACKGROUND } from "./backgrounds";
import { drawFrameVignette, drawGlassFade, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import { COLOR } from "./theme";

/** 판의 크기와 이름줄 뒤로 내려오는 어둠의 자리. 좌표는 몸판 가운데가 0이다. */
export interface InfoPopupFrameSize {
  width: number;
  height: number;
  nameFade: { top: number; height: number };
}

/** 판 위에 칸·액자·글을 올릴 층과, 판 실루엣대로 원화를 자를 마스크다. */
export interface InfoPopupFrame {
  chrome: Phaser.GameObjects.Container;
  mask: Phaser.Display.Masks.GeometryMask;
  /** 팝업 층의 깊이. 원화·SD는 이 값과 `chrome`(+0.6) 사이의 제 층에 선다. */
  depth: number;
}

/**
 * 정보창을 줄여 놓은 판 한 장 — **적 정보창과 소환수 창이 함께 쓴다.**
 *
 * 배경 원화 · 검은 면 · 가장자리 누르기 · 사방 검은 외곽선 · 이름줄 어둠 · 칸을 올릴 층까지가
 * 판이다. 두 창이 저마다 그리면 같은 무게의 창이 어디서는 선이 있고 어디서는 없게 된다.
 * 부르는 쪽은 `PopupLayer.open`의 본문 콜백 안에서 부르고, 받은 `chrome`에 제 칸을 얹는다.
 */
export function mountInfoPopupFrame(scene: Phaser.Scene, popups: PopupLayer, body: Phaser.GameObjects.Container, size: InfoPopupFrameSize): InfoPopupFrame {
  // 정보창을 줄여 놓은 판이라 **배경 원화도 같은 것을 깐다.** 판과 같은 실루엣으로 잘라
  // 깎인 모서리 밖으로 나가지 않게 한다.
  const shape = popupArtShape(size.width, size.height);
  addPopupBackgroundImage(scene, body, BACKGROUND.info, { x: 0, y: 0, width: size.width, height: size.height, maskShape: shape, overlayStrength: 0.62 });
  // 정보창은 원화 위에 **은은한 검은 면 한 겹**을 깔아 인물과 글자를 앞으로 끌어낸다.
  // 같은 값(`COLOR.void` 0.52)을 그대로 쓰고 판과 같은 실루엣으로 자른다.
  body.add(scene.add.rectangle(0, 0, size.width, size.height, COLOR.void, 0.52).setMask(popupBodyShapeMask(scene, body, shape)));
  // 가장자리 누르기도 정보창과 **같은 세기**(0.6)다. 화면이 아니라 판 안에서 가운데로 눈이 간다.
  body.add(drawFrameVignette(scene, 0, 0, size.width, size.height, { strength: 0.6, spread: 0.18 }).setMask(popupBodyShapeMask(scene, body, shape)));
  /*
   * **이 창만 사방 외곽선을 두른다.**
   *
   * 홀로그램 규칙은 판때기에 테두리를 두르지 않지만(위·구분선만), 이 판은 배경 원화 위에
   * 원화 한 장을 통째로 세우고 그 원화가 판 밑변에서 잘린다 — 선이 없으면 어디까지가 창이고
   * 어디부터가 뒤 화면인지 흐려져 잘린 단면이 "덜 그려진 것"처럼 보인다. 선은 **몸판과 같은
   * 도형**을 따라가므로 깎인 두 모서리도 그대로 돈다.
   *
   * 색은 강조색이 아니라 **검정**이다 — 강조색 선을 사방에 두르면 그 선이 판 안의 강조색
   * 수치·제목과 같은 무게로 읽혀 창 전체가 한 겹 더 시끄러워진다. 어두운 획은 배경에서
   * 판을 떼어 놓는 일만 하고 물러난다.
   *
   * 판(`body`)에 넣는 이유는 원화 때문이다 — 원화 위층에 두르면 그 층의 이름줄 어둠과
   * 함께 움직여야 하고, 제목표는 `moveTitle`로 그보다 더 위에 올려 두었다.
   */
  body.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.void, alpha: 0.92, width: 7 }));
  // 원화와 SD는 판 위에 서지만 그 위의 칸·액자에는 가려야 한다. Puppet은 컨테이너 변환을
  // 물려받지 않아 판 안에 넣을 수 없으므로, 팝업 층과 다음 팝업(쪽지) 사이에 두 층을 낸다.
  const depth = body.parentContainer?.depth ?? popups.baseDepth;
  const mask = popupBodyShapeMask(scene, body, shape);
  const chrome = scene.add.container(body.x, body.y).setDepth(depth + 0.6).setAlpha(0).setScale(0.96);
  // 이름줄 뒤의 어둠은 원화보다 위, 글자보다 아래다 — 정보창과 같이 판이 아니라 내려오는
  // 그라데이션 한 겹이라, 밝은 원화 앞에서도 이름과 개체번호가 읽힌다. **판 윗변에서**
  // 시작해야 시작선이 가로줄로 보이지 않는다.
  chrome.add(drawGlassFade(scene, 0, size.nameFade.top + size.nameFade.height / 2, size.width, size.nameFade.height, { topAlpha: 0.9, bottomAlpha: 0 }).setMask(popupBodyShapeMask(scene, chrome, shape)));
  // 판과 함께 떠오르게 같은 등장 tween을 건다 — 층이 다르다고 따로 나타나면 두 장으로 보인다.
  scene.tweens.add({ targets: chrome, alpha: 1, duration: 160 });
  scene.tweens.add({ targets: chrome, scale: 1, duration: 200, ease: "Cubic.Out" });
  // 제목표를 이 층으로 끌어올린다 — 판 안에 두면 바로 위의 이름줄 어둠이 `/정보창`과 그
  // 그림자를 함께 눌러 흐려진다. 판과 같은 자리·같은 배율이라 좌표는 그대로 맞는다.
  popups.moveTitle(body, chrome);
  // 아군 정보창과 **같은 검사 계약**을 게시한다 — 두 원화는 ZIP을 내려받아 세우므로 첫
  // 프레임보다 늦게 도착하고, 그 전에 찍은 그림은 판만 있고 인물이 없다. 같은 창을 보는
  // 두 화면이 서로 다른 신호를 쓰면 자동화가 한쪽만 기다리게 된다.
  setDebugInfoAssetReady({ portrait: false, sd: false });
  return { chrome, mask, depth };
}
