import type { Banner } from "../core/gacha";
import { PLAYABLE_RELICS } from "./relics";

const ALL = PLAYABLE_RELICS.map((r) => r.id);

/**
 * 발굴 배너. 지금은 렐릭이 여섯이라 둘 다 전체 풀을 쓰고 비용만 다르다.
 * 등급과 픽업은 렐릭이 30종에 가까워지면 나눈다.
 */
export const BANNERS: Banner[] = [
  {
    id: "fossil",
    name: "화석 발굴",
    featuredRelicId: "anky",
    desc: "굳은 화석에서 DNA를 긁어낸다. 흔하게 돌릴 수 있다.",
    currency: "fossil",
    costOne: 100,
    costTen: 900,
    pool: ALL,
  },
  {
    id: "amber",
    name: "호박석 발굴",
    featuredRelicId: "rex",
    desc: "호박에 갇힌 온전한 DNA. 보존 상태가 좋아 결과도 좋다.",
    currency: "amber",
    costOne: 2,
    costTen: 18,
    pool: ALL,
  },
];

export function getBanner(id: string): Banner {
  const found = BANNERS.find((b) => b.id === id);
  if (!found) throw new Error(`알 수 없는 배너 id: ${id}`);
  return found;
}
