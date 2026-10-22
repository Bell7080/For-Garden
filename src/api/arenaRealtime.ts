import { RealtimeClient } from '@supabase/realtime-js';
const listeners=new Set<()=>void>();
let client:RealtimeClient|null=null;
let epoch=0;
export function subscribeArenaChanges(callback:()=>void):()=>void {listeners.add(callback);return()=>{listeners.delete(callback);};}
/** A wakeup triggers an authenticated fetch. Never accept room state or winners from a peer broadcast. */
export async function connectArenaRealtime(getToken:(()=>Promise<string|null>)|null):Promise<void> {
  const current=++epoch;
  if(client){client.disconnect();client=null;}
  const url=import.meta.env?.VITE_SUPABASE_URL,key=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!getToken||!url||!key||typeof WebSocket==='undefined')return;
  const token=await getToken();if(!token||current!==epoch)return;
  const next=new RealtimeClient(`${url.replace(/\/$/,'').replace(/^http/,'ws')}/realtime/v1`,{params:{apikey:key},accessToken:getToken});
  client=next;
  await next.setAuth(token);
  if(current!==epoch){next.disconnect();return;}
  next.channel('arena-wakeup').on('postgres_changes',{event:'*',schema:'public',table:'arena_signals'},()=>listeners.forEach(listener=>listener())).subscribe();
}
