/**
 * Puppet 묶음을 **메인 스레드 밖에서** 푸는 일꾼.
 *
 * 도감 한 화면이 카탈로그 전부의 카드를 세우므로, 묶음 스물한 장의 내려받기·ZIP 해제·
 * puppet.json 파싱·원화 디코드가 한꺼번에 일어난다. 그 전부를 메인 스레드에서 하면 그동안
 * 화면이 통째로 멎는다 — 실측으로 네 가지 중 **원화 디코드가 가장 무겁고**(한 장에 400ms
 * 남짓) ZIP 해제와 파싱은 한 장에 10ms 안팎이다. 그래서 넷을 모두 여기서 끝내고, 메인
 * 스레드에는 GPU에 올리기만 남긴다.
 *
 * `puppetforge`(코어)는 렌더러를 모르는 순수 런타임이라 DOM 없이 돈다. Phaser를 쓰는
 * `puppetforge/phaser`는 여기서 절대 읽지 않는다.
 */
import { Puppet } from "puppetforge";
import type { PuppetProject } from "puppetforge";

/** 메인 스레드가 보내는 일감. `id`는 응답을 짝지을 때만 쓴다. */
export interface PuppetParseRequest {
  readonly id: number;
  readonly url: string;
}

/**
 * 일꾼이 돌려주는 결과.
 *
 * `bitmap`은 **소유권을 넘겨** 보내므로 복사 비용이 없다. 원화 디코드까지 실패한 경우에만
 * 원본 바이트(`texture`)를 실어 보내 메인 스레드가 예전 경로로 되돌아갈 수 있게 한다.
 */
export interface PuppetParseResponse {
  readonly id: number;
  readonly project?: PuppetProject;
  readonly bitmap?: ImageBitmap;
  readonly error?: string;
}

self.onmessage = async (event: MessageEvent<PuppetParseRequest>) => {
  const { id, url } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const puppet = await Puppet.load(new Uint8Array(await response.arrayBuffer()));
    const texture = puppet.texture;
    if (!texture) throw new Error("묶음에 원화가 없습니다.");
    // Blob 타입은 SharedArrayBuffer 가능성을 받지 않으므로 독립 복사본으로 감싼다.
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(texture.data)], { type: texture.type }));
    const done: PuppetParseResponse = { id, project: puppet.project, bitmap };
    (self as unknown as Worker).postMessage(done, [bitmap]);
  } catch (error) {
    const failed: PuppetParseResponse = { id, error: error instanceof Error ? error.message : String(error) };
    (self as unknown as Worker).postMessage(failed);
  }
};
