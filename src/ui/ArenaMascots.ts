import Phaser from 'phaser';
import { spawnPuppet, sdAssetFor } from '../puppets/assets';
import { session } from '../state/session';
/** Two decorative SDs, owned by the containing board. Late loads never survive a closed popup. */
export function addArenaMascots(scene:Phaser.Scene, owner:Phaser.GameObjects.Container, x:number,y:number,height:number,clash=true,depth=2100):void {
  let alive=true;
  const bodies:Awaited<ReturnType<typeof spawnPuppet>>[]=[];
  const anchors=[{x:x-height*.46,y},{x:x+height*.46,y}];
  const sparks=scene.add.graphics();owner.add(sparks);
  let elapsed=0;
  const sync=(_time:number,delta:number):void=>{
    if(!alive||!owner.active)return;
    elapsed+=delta;
    const matrix=owner.getWorldTransformMatrix();
    bodies.forEach((body,i)=>{
      const hop=session.settings.accessibility.reduceMotion?0:Math.abs(Math.sin(elapsed/240+i*.8))*height*.065;
      const push=clash&&!session.settings.accessibility.reduceMotion?Math.sin(elapsed/450)*height*.06*(i===0?1:-1):0;
      const p=matrix.transformPoint(anchors[i].x+push,anchors[i].y-hop);
      body.setPosition(p.x,p.y);
      if(clash && !session.settings.accessibility.reduceMotion) body.setAngle((i===0?1:-1)*(3+3*Math.sin(elapsed/450)));
    });
    sparks.clear();
    if(clash) {
      const pulse=session.settings.accessibility.reduceFlashes?.5:.45+.2*Math.sin(elapsed/100);
      sparks.lineStyle(3,0x93ddff,pulse);
      sparks.beginPath();sparks.moveTo(x-20,y-height*.73);sparks.lineTo(x+16,y-height*.58);sparks.lineTo(x-12,y-height*.48);sparks.lineTo(x+20,y-height*.3);sparks.strokePath();
    }
  };
  const cleanup=():void=>{if(!alive)return;alive=false;scene.events.off('update',sync);scene.events.off('shutdown',cleanup);bodies.forEach(p=>p.destroy());};
  owner.once('destroy',cleanup);scene.events.once('shutdown',cleanup);scene.events.on('update',sync);
  ['rex','spino'].forEach((id,i)=>void spawnPuppet(scene,sdAssetFor(id),{x:0,groundY:0,height,depth,flipX:i===1,startPaused:true}).then(body=>{
    if(!alive||!owner.active){body.destroy();return;}
    bodies[i]=body;body.setName(`arena-mascot-${id}`);body.setAnimationFrozen(false).setVisible(true);body.disableInteractive();sync(0,0);
  }).catch(()=>undefined));
}
