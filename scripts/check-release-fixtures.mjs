// Compile the actual adapters in each build mode, then exercise real requests without DB/network calls.
import { build } from "esbuild";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const directory = await mkdtemp(join(tmpdir(), "forgarden-release-fixtures-"));
const now = new Date("2026-10-17T12:00:00.000Z");
let qaPool;
try {
  for (const mode of ["qa", "test", "production"]) {
    const qa = mode !== "production";
    const outfile = join(directory, `${mode}.mjs`);
    await build({
      stdin: {
        contents: `export {TEMP_AD_REWARD_ENABLED,tempAdToken,PLACEHOLDER_AD_ENABLED,placeholderAdToken} from './src/core/tempAd';
          export {runPlatformPurchase} from './src/api/platformPurchase';
          export {connectServerProgress} from './src/api/serverProgress';
          export {FakeServer} from './src/api/FakeServer';
          export {FakeSocialServer} from './src/api/FakeSocialServer';
          export {createDefaultSession} from './src/state/session';
          export {duelNpcPool} from './src/core/duelNpcPool';
          export {simulateDuelDefenses} from './src/core/duelDefense';
          export {normalizeDuelState} from './src/core/duelState';
          export {duelSeasonId} from './src/core/duelArena';
          export {PRODUCTS} from './src/data/shopCatalog';
          export {premiumStatusOf} from './src/ui/premiumStatus';
          export {EXPEDITION_BEST_SCORE_REWARD_STAGES} from './src/data/expedition';
          export {displayRankingEntries} from './src/ui/expeditionRankingLayout';`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      define: {
        "import.meta.env": JSON.stringify({
          MODE: mode,
          DEV: false,
          PROD: true,
        }),
        __PF_BUILD_COMMIT__: JSON.stringify("release-fixtures-probe"),
      },
    });
    const module = await import(pathToFileURL(outfile).href);
    assert.equal(module.displayRankingEntries([], 5000, true).length > 0, qa, `${mode}: expedition sample rows must be QA-only`);
    const actual = {rank:208,playerId:"actual",displayName:"player",score:10,achievedAt:"",isMe:true};
    assert.deepEqual(module.displayRankingEntries([actual], 10, false), [actual], `${mode}: preserve absolute server rank`);
    assert.deepEqual(await module.connectServerProgress({ account: null }), qa ? { ok: true, mode: "local" } : { ok: false, code: "unsupported" }, `${mode}: offline progression boundary`);
    const {
      FakeServer,
      FakeSocialServer,
      createDefaultSession,
      duelNpcPool,
      simulateDuelDefenses,
      normalizeDuelState,
      duelSeasonId,
      PRODUCTS,
      EXPEDITION_BEST_SCORE_REWARD_STAGES,
    } = module;
    const options = { latencyMs: 0, now: () => now, random: () => 0.1 };
    const state = createDefaultSession();
    state.wallet.gems = 10000;
    state.duel = normalizeDuelState(
      {
        ...state.duel,
        seasonId: duelSeasonId(now),
        wins: 1,
        score: 500,
        seasonBestScore: 500,
        defenseSimAt: "2026-10-15T12:00:00.000Z",
        pendingSeasonReward: { seasonId: "previous", tierId: "bronze" },
      },
      [...state.owned],
    );
    const server = new FakeServer(state, options);
    const before = JSON.stringify({ duel: state.duel, wallet: state.wallet });
    const status = await server.getDuelStatus();
    const ranking = await server.getDuelRanking();
    assert.equal(status.opponents.length > 0, qa, `${mode}: mock opponents`);
    assert.equal(status.rank !== null, qa, `${mode}: invented duel rank`);
    assert.equal(ranking.entries.length > 0, qa);
    if (!qa) {
      assert.equal(status.pendingSeasonReward, null);
      assert.deepEqual(status.history, []);
      assert.equal(ranking.me, null);
      for (const action of [
        () => server.refreshDuelOpponents(),
        () => server.buyDuelAttempt(),
        () => server.claimDuelSeasonReward(),
        () =>
          server.enterDuel({
            requestId: "release-admission",
            opponentId: "duel-npc-0",
            relicIds: [...state.owned].slice(0, 3),
          }),
        () => server.resolveDuel({ requestId: "release-result", won: true }),
      ])
        await assert.rejects(
          action,
          (error) => error.code === "DUEL_UNAVAILABLE",
        );
      assert.equal(
        JSON.stringify({ duel: state.duel, wallet: state.wallet }),
        before,
        "blocked mock duel must not spend, simulate or grant",
      );
    }
    const pool = duelNpcPool(duelSeasonId(now));
    assert.equal(pool.length, qa ? 240 : 0);
    if (qa) qaPool = pool;
    const defenseState = {
      ...state.duel,
      defenseSimAt: "2026-10-15T12:00:00.000Z",
    };
    const defense = simulateDuelDefenses(
      defenseState,
      now,
      qaPool,
      1e9,
      () => 0.1,
    );
    assert.equal(
      defense.entries.length > 0,
      qa,
      `${mode}: fake defense simulation`,
    );
    if (!qa) assert.equal(defense.state, defenseState);
    const friends = await new FakeSocialServer(() =>
      now.getTime(),
    ).getFriends();
    assert.equal(friends.friendPoints, qa ? 120 : 0);
    assert.equal(friends.friends.length > 0, qa);

    // A stale prior-week score must not become a first-place mail in production.
    state.expedition.weekKey = "2026-10-05";
    state.expedition.bestScore = 5000;
    state.expedition.bestAchievedAt = "2026-10-08T12:00:00.000Z";
    const mail = await server.getMails();
    assert.equal(
      mail.mails.some((m) => m.id === "launch-gift"),
      qa,
    );
    assert.equal(
      mail.mails.some((m) => m.id === "update-notice"),
      qa,
    );
    assert.equal(
      mail.mails.some((m) => m.id.startsWith("expedition-rank:")),
      qa,
    );
    const stage = EXPEDITION_BEST_SCORE_REWARD_STAGES[0];
    state.expedition.bestScore = stage.threshold;
    const weekly = await server.getExpeditionWeeklyBest();
    const leaderboard = await server.getExpeditionLeaderboard();
    assert.equal(weekly.rank, qa ? 1 : null);
    assert.equal(leaderboard.entries.length, qa ? 1 : 0);
    if (!qa) {
      assert.deepEqual(weekly.rankRewards, {});
      const wallet = structuredClone(state.wallet);
      await assert.rejects(
        () =>
          server.claimMailRewards({
            requestId: "release-mail-attempt",
            mailIds: ["launch-gift", "expedition-rank:2026-10-05"],
          }),
        (error) => error.code === "INVALID_STATE",
      );
      assert.deepEqual(state.wallet, wallet);
    }
    // Actual personal score milestones stay available even while mock ranking is disabled.
    const scoreReward = await server.claimExpeditionReward({
      requestId: "release-score-reward",
      stageId: stage.id,
    });
    assert.equal(scoreReward.reward.amount, stage.reward.amount);

    const receiptProduct = PRODUCTS.find(
      (p) => p.acquisition.kind === "platform_payment",
    );
    assert.ok(receiptProduct);
    const receipt = {
      platform: "test",
      requestId: "release-test-receipt",
      productId: receiptProduct.id,
      receipt: `verified-receipt:${receiptProduct.id}:test-transaction`,
    };
    const ad = {
      requestId: "release-test-ad",
      slotId: "gold-ad",
      verificationToken: "verified:gold-ad",
    };
    if (qa) {
      assert.equal(
        (await server.verifyPurchaseReceipt(receipt)).verified,
        true,
      );
      await server.claimAdReward(ad);
    } else {
      const wallet = structuredClone(state.wallet);
      await assert.rejects(
        () => server.verifyPurchaseReceipt(receipt),
        (error) => error.code === "RECEIPT_INVALID",
      );
      await assert.rejects(
        () => server.claimAdReward(ad),
        (error) => error.code === "AD_TOKEN_INVALID",
      );
      assert.deepEqual(state.wallet, wallet);
      assert.equal(module.TEMP_AD_REWARD_ENABLED, false, "production must reject unsigned temporary ads");
      const tempState = createDefaultSession();
      const tempServer = new FakeServer(tempState, options);
      await assert.rejects(() => tempServer.claimAdReward({ requestId: "release-temp-ad", slotId: "gold-ad", verificationToken: module.tempAdToken("gold-ad") }), error => error.code === "AD_TOKEN_INVALID");
      // 자리표시 광고 토큰은 켜진 동안만 받아들이고, 실제 검증자가 주입되면 그쪽만 따른다.
      const placeholderState = createDefaultSession();
      const placeholderServer = new FakeServer(placeholderState, options);
      const placeholderClaim = placeholderServer.claimAdReward({ requestId: "release-placeholder-ad", slotId: "gold-ad", verificationToken: module.placeholderAdToken("gold-ad") });
      if (module.PLACEHOLDER_AD_ENABLED) await placeholderClaim;
      else await assert.rejects(() => placeholderClaim, error => error.code === "AD_TOKEN_INVALID");
      const catalog = await server.getProducts("premium");
      assert.ok(catalog.products.filter(p => p.acquisition.kind === "platform_payment").every(p => !p.purchasable));
      for (const product of catalog.products.filter(p => p.acquisition.kind === "platform_payment")) {
        assert.ok(product.remaining > 0, `${product.id}: a new account retains its purchase limit`);
        assert.equal(module.premiumStatusOf(product), undefined, `${product.id}: payment unavailable must not mean purchased or sold out`);
        assert.ok(product.disabledReason, `${product.id}: preserve the payment unavailable explanation`);
      }
      assert.ok((await server.getAdOperationsConfig()).slots.every(slot => slot.enabled === module.PLACEHOLDER_AD_ENABLED), "ad slots follow the pre-release placeholder flag");
      const paidProduct = catalog.products.find(p => p.acquisition.kind === "platform_payment");
      assert.ok(paidProduct);
      let sdkCalled = false;
      const blockedPurchase = await module.runPlatformPurchase(server, { requestPayment: async () => { sdkCalled = true; throw Error("SDK must not charge"); } }, paidProduct);
      assert.equal(blockedPurchase.status, "unsupported");
      assert.equal(sdkCalled, false);
      // Explicit validators remain usable for real providers; no test-prefix shortcut is required.
      const liveState = createDefaultSession();
      const verifiedServer = new FakeServer(liveState, {
        ...options,
        verifyAdToken: (token) => token === "provider-verified-ad",
        verifyPurchaseReceipt: (payload, productId) =>
          payload === "provider-verified-purchase"
            ? `${productId}-provider-transaction`
            : null,
      });
      const verified = await verifiedServer.verifyPurchaseReceipt({
        ...receipt,
        platform: "google",
        receipt: "provider-verified-purchase",
      });
      assert.equal(verified.verified, true);
      await verifiedServer.claimAdReward({
        ...ad,
        verificationToken: "provider-verified-ad",
      });
      assert.equal(liveState.wallet.gold, 5000);
      // Validated subscription mail must not be removed with the QA welcome fixtures.
      const subscription = PRODUCTS.find(
        (p) =>
          p.passBenefit?.dailyBonus && "itemId" in p.passBenefit.dailyBonus,
      );
      assert.ok(subscription);
      const subscribed = await verifiedServer.verifyPurchaseReceipt({
        platform: "google",
        requestId: "subscription-receipt",
        productId: subscription.id,
        receipt: "provider-verified-purchase",
      });
      await verifiedServer.activatePass({
        requestId: "subscription-activate",
        verificationId: subscribed.verificationId,
      });
      const actualMails = await verifiedServer.getMails();
      assert.ok(
        actualMails.mails.some((m) => m.id.startsWith("subscription:")),
      );
      assert.ok(!actualMails.mails.some((m) => m.id === "launch-gift"));
    }
    console.log(
      `PASS ${mode}: duel fixtures, defense, leaderboard, friend points, mail, verifier defaults and personal score rewards.`,
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
