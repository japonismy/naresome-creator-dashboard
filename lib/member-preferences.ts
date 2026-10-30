import {CURRENT_WRITERS,CURRENT_EDITORS,MEMBER_DIRECTORY_VERSION} from './member-directory';
export const MEMBER_FILTER_DEFAULTS_VERSION='20261028-current-team-v2';
export function restoreMemberFilters(raw:string|null){
  let saved:Record<string,unknown>={};try{saved=JSON.parse(raw||'{}');if(!saved||typeof saved!=='object')saved={};}catch{}
  const current=saved.directoryVersion===MEMBER_DIRECTORY_VERSION;
  const subset=(value:unknown,known:string[])=>{const values=Array.isArray(value)?known.filter(n=>value.includes(n)):[];return values.length?values:[...known];};
  const writers=current?subset(saved.currentWriters,CURRENT_WRITERS):[...CURRENT_WRITERS];
  const editors=current?subset(saved.currentEditors,CURRENT_EDITORS):[...CURRENT_EDITORS];
  const defaultsCurrent=current&&saved.filterDefaultsVersion===MEMBER_FILTER_DEFAULTS_VERSION;
  const currentOnly=defaultsCurrent?saved.currentOnly!==false:true,currentEditorOnly=defaultsCurrent?saved.currentEditorOnly!==false:true;
  // An individual selected last visit must never become the initial filter.
  const writer='',editor='';
  return {writer,editor,currentWriters:writers,currentEditors:editors,currentOnly,currentEditorOnly};
}
