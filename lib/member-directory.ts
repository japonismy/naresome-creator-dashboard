// Current team confirmed by the owner on 2026-10-28. Names follow Discord.
export const MEMBER_DIRECTORY_VERSION='20261028-discord-v1';
export const CURRENT_WRITERS=['黒猫美味しい','ことり','めろこ','ちぃ','下田','takoyakiyaketane'];
export const CURRENT_EDITORS=['ju.','土屋','honami','mi.','syaruru','福ミツル'];
export function writerLabel(name:string){return memberName('writer',name);}
export function memberName(role:'writer'|'editor',value:string){
  const name=value.trim();
  const normalized=name.normalize('NFKC');
  const aliases:Record<string,string>=role==='writer'?{'うり':'ことり','ことり(旧うり)':'ことり','黒猫おいしい':'黒猫美味しい'}:{};
  return aliases[normalized]??name;
}
