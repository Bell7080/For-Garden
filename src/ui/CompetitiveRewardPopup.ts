import type Phaser from 'phaser';
import { t } from '../i18n';
import { WEEKLY_RANK_GEMS } from '../data/competitiveRewards';
import type { PopupLayer } from './PopupLayer';
import { COLOR, textStyle } from './theme';
import { CURRENCY_ICON_BY_WALLET } from './currencyIcons';
/** 두 순위표가 같은 보상표와 마감/참가 조건을 표시한다. */
export function openCompetitiveRewards(scene: Phaser.Scene, popups: PopupLayer): void {
  popups.open({ width: 880, height: 1000, title: t('expedition.weeklyReward'), dim: true, closeOnBackdrop: true }, body => {
    body.add(scene.add.text(0, -330, t("ranking.weekly.rules"), textStyle({ role: "body", size: 26, color: COLOR.inkDim, wrap: 760, align: 'center' })).setOrigin(.5));
    let from = 1;
    WEEKLY_RANK_GEMS.forEach((row, index) => {
      const y = -140 + index * 90;
      const label = row.upTo === null ? `${from}+` : row.upTo === from ? `${from}` : `${from}–${row.upTo}`;
      body.add(scene.add.text(-300, y, label, textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0,.5));
      body.add(scene.add.image(100,y,CURRENCY_ICON_BY_WALLET.gems).setDisplaySize(44,44));
      body.add(scene.add.text(300, y, row.gems.toLocaleString(), textStyle({ role: "emphasis", size: 34, color: COLOR.accentText })).setOrigin(1,.5));
      from = (row.upTo ?? from) + 1;
    });
  });
}
