import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { FIRST_MEETING_FALLBACK, firstMeetingLine } from "../../src/data/relicFirstMeetings";
import {
  SHOWCASE_COMPOSITION,
  SHOWCASE_INFO,
  SHOWCASE_OVERSCAN,
  SHOWCASE_SIZE,
  SHOWCASE_TAP_LOCK_MS,
  showcaseDots,
  showcaseSparkles,
} from "../../src/ui/newRelicShowcaseLayout";

describe("새로 만난 렐릭의 소개 장면", () => {
  it("뽑을 수 있는 모든 개체가 제 한마디를 갖는다", () => {
    // 목소리 막은 그 개체의 한 줄로 시작한다. 공통 인사가 서면 누가 왔는지 읽히지 않는다.
    for (const relic of PLAYABLE_RELICS) {
      expect(firstMeetingLine(relic.id), relic.id).not.toBe(FIRST_MEETING_FALLBACK.text);
    }
  });

  it("SSR은 색이 아니라 구도부터 다르다", () => {
    const ssr = SHOWCASE_COMPOSITION.SSR;
    for (const rarity of ["SR", "R"] as const) {
      const other = SHOWCASE_COMPOSITION[rarity];
      // 전신이 더 크고 더 비켜 서며, 옆에서 밀려 들어온다.
      expect(ssr.portrait.height).toBeGreaterThan(other.portrait.height);
      expect(ssr.portrait.x).toBeGreaterThan(other.portrait.x);
      expect(Math.abs(ssr.enterFrom.x)).toBeGreaterThan(Math.abs(other.enterFrom.x));
      // 띠가 비스듬하고, 빛줄기·세로 표식·흔들림은 SSR만 갖는다.
      expect(ssr.band.angle).not.toBe(0);
      expect(other.band.angle).toBe(0);
      expect(other.rays).toBe(0);
      expect(other.watermark).toBe(false);
      expect(other.shake).toBeUndefined();
      expect(ssr.flashes).toBeGreaterThan(other.flashes);
      expect(ssr.sparkles).toBeGreaterThan(other.sparkles);
    }
    expect(ssr.rays).toBeGreaterThan(0);
    expect(ssr.watermark).toBe(true);
    expect(ssr.shake).toBeDefined();
  });

  it("정보 조각은 화면 안에 선다", () => {
    const { width, height } = SHOWCASE_SIZE;
    const I = SHOWCASE_INFO;
    expect(I.radar.x + I.radar.radius).toBeLessThan(width);
    // 오각형을 받치는 판도 화면 안에 든다.
    expect(I.radar.x + I.radar.plate.width / 2).toBeLessThanOrEqual(width);
    expect(I.radar.y + I.radar.plate.height / 2).toBeLessThan(I.hintY);
    expect(I.radar.y + I.radar.radius).toBeLessThan(height);
    expect(I.hintY).toBeLessThan(height);
    // 이름 블록은 밑동의 어둠 안에 든다 — 밝은 원화 위에서 글자가 떠 보이지 않는다.
    expect(I.rarity.y).toBeGreaterThan(I.fade.top);
    expect(I.badges.y).toBeLessThan(I.radar.y + I.radar.radius);
  });

  it("점 무늬는 띠 안에 들고, 가장자리일수록 크고 진하다", () => {
    const dots = showcaseDots(800, 300, 20);
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(Math.abs(dot.y)).toBeLessThanOrEqual(150);
      expect(Math.abs(dot.x)).toBeLessThanOrEqual(400);
    }
    const edge = dots.reduce((a, b) => (Math.abs(a.y) > Math.abs(b.y) ? a : b));
    const inner = dots.reduce((a, b) => (Math.abs(a.y) < Math.abs(b.y) ? a : b));
    expect(edge.r).toBeGreaterThan(inner.r);
    expect(edge.alpha).toBeGreaterThan(inner.alpha);
    // 난수를 쓰지 않는다.
    expect(showcaseDots(800, 300, 20)).toEqual(dots);
  });

  it("떠오르는 조각은 화면 안에서 출발하고 같은 그림을 그린다", () => {
    const sparks = showcaseSparkles(9);
    for (const spark of sparks) {
      expect(spark.x).toBeGreaterThan(0);
      expect(spark.x).toBeLessThan(SHOWCASE_SIZE.width);
      expect(spark.y).toBeGreaterThan(0);
      expect(spark.y).toBeLessThan(SHOWCASE_SIZE.height);
    }
    expect(showcaseSparkles(9)).toEqual(sparks);
  });
});

describe("다다닥 누름이 장면을 날려 버리지 않는다", () => {
  it("막마다 최소한 서 있는 시간이 있고, 등장 막은 섬광·밀려 들어오기가 끝날 만큼 길다", () => {
    expect(SHOWCASE_TAP_LOCK_MS.voice).toBeGreaterThanOrEqual(500);
    expect(SHOWCASE_TAP_LOCK_MS.stage).toBeGreaterThanOrEqual(1000);
    const source = readFileSync("src/ui/NewRelicShowcase.ts", "utf8");
    const tap = source.slice(source.indexOf("  private tap(): void {"));
    // 잠금 검사가 막을 넘기는 어느 분기보다도 먼저 선다.
    expect(tap.indexOf("tapLockedUntil")).toBeLessThan(tap.indexOf("enterStage"));
  });

  it("흔들려도 가장자리가 드러나지 않는다 — 화면을 덮는 층은 흔들림보다 넓게 뻗는다", () => {
    const shake = SHOWCASE_COMPOSITION.SSR.shake!;
    // Phaser 카메라 흔들림은 화면 크기에 강도를 곱한 만큼 움직인다.
    expect(SHOWCASE_OVERSCAN).toBeGreaterThan(SHOWCASE_SIZE.width * shake.intensity * 2);
    const source = readFileSync("src/ui/NewRelicShowcase.ts", "utf8");
    // 화면 크기 그대로(W, H) 까는 덮개가 다시 생기면 잡는다.
    expect(source).not.toMatch(/rectangle\(W \/ 2, H \/ 2, W, H, COLOR\.void/);
    expect(source).not.toMatch(/drawVignette\(scene, W, H/);
  });

  it("3D 판은 visibility가 아니라 투명도로 숨긴다 — 카드 층이 제 visible로 뚫고 나온다", () => {
    const source = readFileSync("src/ui/ResearchCinematic.ts", "utf8");
    const intro = source.slice(source.indexOf("  private async runIntroduction("));
    expect(intro).toContain('style.opacity = "0"');
    expect(intro).toContain('style.pointerEvents = "none"');
    expect(intro).not.toContain('style.visibility = "hidden"');
  });
});

describe("소개 장면은 카드가 뒤집히기 전에 돈다", () => {
  it("시네마틱은 다음 걸음을 넘기기 전에 본다", () => {
    const script = readFileSync("scripts/prepare_research_cinematic.py", "utf8");
    const baked = readFileSync("public/cinematic/researchCinematic.js", "utf8");
    // 굽는 규칙과 구운 결과가 같은 함수를 갖는다 — 스크립트만 고치고 다시 굽지 않으면 여기서 잡힌다.
    expect(script).toContain("xo.prototype.peekReveal=function()");
    expect(baked).toContain("xo.prototype.peekReveal=function()");

    const source = readFileSync("src/ui/ResearchCinematic.ts", "utf8");
    const tap = source.slice(source.indexOf("  private tap(): void {"));
    // 넘기기 전에 엿보고, 새 렐릭의 뒤집기면 소개가 먼저다.
    expect(tap.indexOf("peekReveal")).toBeGreaterThan(-1);
    expect(tap.indexOf("peekReveal")).toBeLessThan(tap.indexOf("this.instance.advance()"));
    expect(tap).toContain("runIntroduction");
    // 건너뛰기도 남은 소개를 먼저 돈 뒤 결산으로 간다.
    const skip = source.slice(source.indexOf("  private async skipAfterIntroductions()"));
    expect(skip.indexOf("runIntroduction")).toBeLessThan(skip.indexOf("skipToResult"));
  });

  it("결과판도 칸을 열기 전에 소개한다", () => {
    const source = readFileSync("src/scenes/LabScene.ts", "utf8");
    const open = source.slice(source.indexOf("  private async openSlot("));
    expect(open.indexOf("introduceRelic")).toBeGreaterThan(-1);
    expect(open.indexOf("introduceRelic")).toBeLessThan(open.indexOf("tile.reveal()"));
    const all = source.slice(source.indexOf("  private async openEverySlot()"));
    expect(all.indexOf("introduceRelic")).toBeLessThan(all.indexOf("tile.reveal(true)"));
  });
});
