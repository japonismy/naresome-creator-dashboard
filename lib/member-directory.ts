// Current team confirmed by the owner on 2026-10-28. Names follow Discord.
export const MEMBER_DIRECTORY_VERSION='20261030-discord-names-v4';
export const CURRENT_WRITERS=['sasaki4070','黒猫美味しい','ことり','めろこ','ちぃ','下田','takoyakiyaketane'];
export const CURRENT_EDITORS=['ju','mi','honami','土屋','syaruru','福ミツル'];
export function writerLabel(name:string){return memberName('writer',name);}
export function memberName(role:'writer'|'editor',value:string){
  const name=value.trim();
  const normalized=name.normalize('NFKC');
  const aliases:Record<string,string>=role==='writer'?{'うり':'ことり','ことり(旧うり)':'ことり','黒猫おいしい':'黒猫美味しい','SASAKI':'sasaki4070','SASAKI(シ)':'sasaki4070','SASAKI.moji':'sasaki4070','@sasaki4070':'sasaki4070','佐々木':'sasaki4070'}:{'ju.':'ju','mi.':'mi'};
  return aliases[normalized]??name;
}

// Production 297 starts the current writer; earlier homonyms are another person.
export function videoWriter(name:string,productionNo:number){
  const normalized=memberName('writer',name);
  return normalized==='ちぃ'&&productionNo<297?'ちぃ（旧担当）':normalized;
}
export function sortMembers(names:string[],order:string[]){
  const positions=new Map(order.map((name,index)=>[name,index]));
  return [...names].sort((a,b)=>(positions.get(a)??Number.MAX_SAFE_INTEGER)-(positions.get(b)??Number.MAX_SAFE_INTEGER)||a.localeCompare(b,'ja'));
}
