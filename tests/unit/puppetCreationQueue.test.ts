import { describe, expect, it, vi } from "vitest";
import { PuppetCreationQueue } from "../../src/puppets/creationQueue";

describe('전투 모델 생성 프레임 예산',()=>{
  it('GPU 프레임이 늦어져도 다음 작업을 rAF 완료에 묶지 않는다',async()=>{
    const raf=vi.fn();vi.stubGlobal('requestAnimationFrame',raf);
    try{
      let clock=0;const queue=new PuppetCreationQueue({now:()=>clock});
      await queue.run(async()=>{clock+=9;});
      await expect(queue.run(async()=>42)).resolves.toBe(42);
      expect(raf).not.toHaveBeenCalled();expect(queue.stats.yields).toBe(1);
    }finally{vi.unstubAllGlobals();}
  });
  it('8ms 작업마다 화면에 제어를 돌려주고 생성 순서와 반환값을 유지한다',async()=>{
    let clock=0;const order:string[]=[];
    const queue=new PuppetCreationQueue({now:()=>clock,yieldFrame:async()=>{order.push('paint');},budgetMs:8});
    const values=await Promise.all(Array.from({length:6},(_,i)=>queue.run(async()=>{order.push(String(i));clock+=4;return i;})));
    expect(values).toEqual([0,1,2,3,4,5]);
    expect(order).toEqual(['0','1','paint','2','3','paint','4','5']);
    expect(queue.stats).toEqual({completed:6,yields:2,maxTaskMs:4});
  });
  it('실패한 모델 때문에 뒤의 모델 생성이 영구 대기하지 않는다',async()=>{
    const queue=new PuppetCreationQueue({now:()=>0});
    await expect(queue.run(async()=>{throw Error('invalid model');})).rejects.toThrow('invalid model');
    await expect(queue.run(async()=>42)).resolves.toBe(42);
  });
  it('프레임 대기 중 전투가 바뀌면 남은 모델을 옛 씬에 만들지 않는다',async()=>{
    let current=true,clock=0,created=0;
    const queue=new PuppetCreationQueue({isCurrent:()=>current,now:()=>clock,yieldFrame:async()=>{current=false;}});
    await queue.run(async()=>{clock+=9;});
    await expect(queue.run(async()=>{created++;})).rejects.toThrow('puppet_creation_cancelled');
    expect(created).toBe(0);
  });
});
