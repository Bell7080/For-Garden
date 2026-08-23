import { createDefaultSettings, normalizeSettings } from "../core/settings";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type GameSettings, type Session } from "../state/session";

/** 설정 변경자가 저장과 알림을 빠뜨리지 않도록 한 공개 변경 경계다. */
export class SettingsManager extends EventTarget {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) { super(); }

  /** 외부 참조로 세션이 변경되지 않도록 정규화된 독립 스냅샷을 반환한다. */
  get(): GameSettings { return normalizeSettings(this.state.settings); }

  /** 섹션 단위 부분 변경을 합친 뒤 보정·저장·이벤트를 항상 같은 순서로 수행한다. */
  update(patch: { [K in keyof GameSettings]?: Partial<GameSettings[K]> }): GameSettings {
    const merged = Object.fromEntries(Object.entries(this.get()).map(([key, value]) => [key, { ...value, ...(patch[key as keyof GameSettings] ?? {}) }])) as unknown as GameSettings;
    this.state.settings = normalizeSettings(merged);
    this.saves.save(this.state);
    this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() }));
    return this.get();
  }

  /** 진행 데이터에는 손대지 않고 환경설정만 초기 상태로 되돌린다. */
  reset(): GameSettings { this.state.settings = createDefaultSettings(); this.saves.save(this.state); this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() })); return this.get(); }
}

/** 모든 씬이 공유하는 단일 설정 진입점이다. */
export const settingsManager = new SettingsManager();
