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
