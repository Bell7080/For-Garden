import type {Page} from '@playwright/test';
/** 진단용 입력 핸들로 실제 Phaser 씬에 접근한다. 제품에 새 디버그 통로를 만들지 않는다. */
export async function sourceScene(page:Page, body:string):Promise<void>{
 const cdp=await page.context().newCDPSession(page);
 const listener=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});
 const props=await cdp.send('Runtime.getProperties',{objectId:listener.result.objectId!});
 const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 const result=await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:`function(){${body}}`});
 if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
}
