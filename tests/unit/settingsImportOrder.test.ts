import { it, expect, vi } from 'vitest';
it('initializes SettingsManager before FakeServer without touching its uninitialized singleton',async()=>{
 vi.resetModules();
 const module=await import('../../src/managers/SettingsManager');
 expect(module.settingsManager.get().presentation.frameRateLimit).toBeGreaterThan(0);
 const server=await import('../../src/api/FakeServer');expect(server.gameApi).toBeDefined();
});
