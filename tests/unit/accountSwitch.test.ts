import { describe, expect, it, vi } from 'vitest';
import { sourceClass } from '../helpers/sourceClass';
describe('설정의 계정 전환',()=>{
 function setup(){let options:any;const reset=vi.fn(),disconnect=vi.fn(),boot=vi.fn(),confirm=vi.fn();
 const Scene=sourceClass('src/scenes/SettingsScene.ts','SettingsScene',{Phaser:{Scene:class{}},PopupLayer:class{confirm=confirm;},openAccountIdPopup:(_s:unknown,_p:unknown,o:unknown)=>{options=o;},disconnectProgress:disconnect,saveManager:{reset},t:(k:string)=>k});
 const scene=new Scene();scene.leaveToBoot=boot;scene.linkWithId();return {options,reset,disconnect,boot,confirm};}
 it('기존 계정 로그인에 성공한 경우에만 연결/로컬 저장을 걷고 부트로 돌아간다',()=>{
 const s=setup();expect(s.reset).not.toHaveBeenCalled();expect(s.options.mode).toBe('link');s.options.onDone({},'signIn');expect(s.disconnect).toHaveBeenCalledTimes(1);expect(s.reset).toHaveBeenCalledTimes(1);expect(s.boot).toHaveBeenCalledTimes(1);expect(s.confirm).not.toHaveBeenCalled();
 });
 it('게스트의 신규 아이디 연동은 로컬 진행을 지우거나 다른 계정으로 전환하지 않는다',()=>{
 const s=setup();s.options.onDone({},'register');expect(s.reset).not.toHaveBeenCalled();expect(s.disconnect).not.toHaveBeenCalled();expect(s.boot).not.toHaveBeenCalled();expect(s.confirm).toHaveBeenCalledTimes(1);
 });
});

describe('계정 조작 입력 잠금 복구',()=>{
 function setup(){const failure=vi.fn(),boot=vi.fn();const Scene=sourceClass('src/scenes/SettingsScene.ts','SettingsScene',{Phaser:{Scene:class{}},PopupLayer:class{}});
 const scene=Object.assign(new Scene(),{viewGeneration:1,input:{enabled:true},scene:{isActive:()=>true},showAccountFailure:failure,leaveToBoot:boot});return {scene,failure,boot};}
 it('로그아웃이 예외를 던져도 잠금을 풀고 안내하며 다시 시도할 수 있다',async()=>{
 const {scene,failure,boot}=setup();await scene.runAccountAction(async()=>{throw Error('storage unavailable');});
 expect(scene.input.enabled).toBe(true);expect(scene.accountBusy).toBe(false);expect(failure).toHaveBeenCalledWith('network-error',undefined);
 await scene.runAccountAction(async()=>({ok:true}));expect(boot).toHaveBeenCalledOnce();
 });
 it('겹친 전환을 막고 재진입한 화면에는 이전 응답을 반영하지 않는다',async()=>{
 const {scene,boot}=setup();let done!:(v:unknown)=>void;const op=vi.fn(()=>new Promise(r=>{done=r;}));
 const first=scene.runAccountAction(op);await scene.runAccountAction(op);expect(op).toHaveBeenCalledOnce();
 scene.viewGeneration++;scene.accountBusy=false;scene.input.enabled=true;done({ok:true});await first;expect(boot).not.toHaveBeenCalled();expect(scene.input.enabled).toBe(true);
 });
});
