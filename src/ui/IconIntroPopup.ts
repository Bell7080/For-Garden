import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { openCuteGuide } from "./CuteGuidePopup";
import type { CuteGuideToneId } from "./cuteGuideLayout";
import type { PopupLayer } from "./PopupLayer";
import { openSpeakerIntro } from "./SpeakerIntroPopup";

/**
 * 아이콘 쪽지 — 콘텐츠에 처음 들어왔을 때 그림 한 장과 짧은 글을 몇 쪽 넘겨 보는 안내. 판은 `CuteGuidePopup`이 그린다.
 *
 * 화면을 짚어 줄 만큼 조작이 얽히지 않은 콘텐츠(상점·원정·레이드 등)가 쓴다. 한 줄 쪽지로는 무엇을 하는 곳인지까지만
 * 읽히고 **왜 다시 와야 하는지**가 빠져, 쪽마다 그림 하나와 한두 문장으로 나눴다. 수치는 적지 않는다(화면이 이미 말한다).
 * 쪽 표는 `contentIntroPages.ts` 한 곳이 갖는다.
 */
export interface IconIntroPage {
  /** 액자 안에 설 그림(재화·아이템·직군 텍스처 키). `speaker`가 있으면 쓰지 않는다. */
  icon: string;
  /**
   * 이 쪽을 말하는 인물(렐릭 ID). 첫 쪽에 있으면 안내 전체가 그 인물이 건네는 판(`SpeakerIntroPopup`)으로 서고,
   * 글은 그 인물의 말투로 쓴다 — 안내를 시스템 문장이 아니라 이야기 속 인물이 건네는 말로 들려줄 때만 쓴다.
   */
  speaker?: string;
  headingKey: TextKey;
  bodyKey: TextKey;
  /** 인물 안내(`speaker`)의 무대에 깔 원화 — 그 말이 가리키는 장소다. 없으면 정보창 배경. */
  backdrop?: string;
  /** 안내 판의 색 — 첫 쪽의 값만 읽는다(콘텐츠마다 한 벌). */
  tone?: CuteGuideToneId;
  /** 무대에 설 아이(렐릭 ID) — 첫 쪽의 값만 읽고, 비우면 애착 렐릭이다. */
  guide?: string;
}

export function openIconIntro(scene: Phaser.Scene, popups: PopupLayer, pages: readonly IconIntroPage[], onClose?: () => void): void {
  if (pages.length === 0) return;
  // 인물이 건네는 안내는 대사 화면 문법의 판으로 선다 — 작은 얼굴 액자 쪽지는 시스템 안내문처럼 읽혔다.
  if (pages[0].speaker) { openSpeakerIntro(scene, popups, pages, onClose); return; }
  // 그 밖의 안내는 귀여운 안내 판 한 벌이다 — 애착 렐릭이 무대에서 뛰고 말풍선이 쪽마다 글을 싣는다(응태 2026-11-28).
  openCuteGuide(scene, popups, {
    title: t("intro.title"),
    tone: pages[0].tone,
    guide: pages[0].guide,
    pages: pages.map((page) => ({ heading: t(page.headingKey), body: t(page.bodyKey), ...(page.icon ? { icon: page.icon } : {}) })),
    onClose,
  });
}
