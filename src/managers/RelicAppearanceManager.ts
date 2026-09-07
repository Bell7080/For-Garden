import { getRelic } from "../data/relics";
import { battleAssetFor, portraitAssetForSkin, sdAssetForSkin, type PuppetAsset } from "../puppets/assets";
import { relicSkinManager, type RelicSkinManager } from "./RelicSkinManager";

/** 장착 상태와 skin-aware resolver를 결합하고 화면에는 최종 에셋만 돌려주는 공개 경계다. */
export class RelicAppearanceManager {
  constructor(private readonly skins: Pick<RelicSkinManager, "equippedFor"> = relicSkinManager) {}

  /** 로컬 장착 ID와 렐릭 기본 원화를 전신 resolver 한곳에서 결합한다. */
  portraitAssetFor(relicId: string): PuppetAsset {
    const relic = getRelic(relicId);
    return portraitAssetForSkin(relic.portraitAssetId, this.skins.equippedFor(relicId));
  }

  /** 전신과 같은 장착 ID를 SD resolver에 전달해 두 표현이 갈리지 않게 한다. */
  sdAssetFor(relicId: string): PuppetAsset {
    return sdAssetForSkin(relicId, this.skins.equippedFor(relicId)) ?? battleAssetFor(relicId);
  }

  /** 상대/적은 로컬 장착 상태를 절대 읽지 않고 정적 전투 외형만 선택한다. */
  battleAssetFor(relicId: string, side: "ally" | "enemy" = "ally"): PuppetAsset {
    return side === "enemy" ? battleAssetFor(relicId) : this.sdAssetFor(relicId);
  }
}

/** 로컬 세션 장착 상태를 사용하는 인게임 공용 외형 관리자다. */
export const relicAppearanceManager = new RelicAppearanceManager();
