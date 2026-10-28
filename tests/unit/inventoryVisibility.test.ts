import {it,expect,vi} from 'vitest';
import {sourceClass} from '../helpers/sourceClass';
it('덮인 가방은 연타 중 변경 신호를 모으고 드러날 때 한 번 갱신한다',()=>{
 let top=false;const Scene=sourceClass('src/ui/InventoryPopup.ts','InventoryPopup',{InventoryManager:class{},session:{},DEFAULT_INVENTORY_SORT:{},createRuneListState:()=>({})});
 const popup=new Scene({}, {isTop:()=>top},{});popup.body={};popup.view={};popup.render=vi.fn();
 popup.inventoryDirty=true;popup.refreshVisible();popup.refreshVisible();expect(popup.render).not.toHaveBeenCalled();
 top=true;popup.refreshVisible();popup.refreshVisible();expect(popup.render).toHaveBeenCalledTimes(1);
});
