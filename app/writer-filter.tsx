'use client';
import {useState} from 'react';
import {Search,Users} from 'lucide-react';
import {writerLabel} from '@/lib/member-directory';
export default function WriterFilter({names,selected,onChange,currentOnly,onToggle,roleLabel='ライター'}:{names:string[];selected:string[];onChange:(names:string[])=>void;currentOnly:boolean;onToggle:(value:boolean)=>void;roleLabel?:string}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[draft,setDraft]=useState<string[]>([]);
  const shown=names.filter(n=>((roleLabel==='ライター'&&n==='ことり'?writerLabel(n)+' うり':n)).toLowerCase().includes(query.toLowerCase()));
  return <div className="writer-roster" role="group" aria-label={roleLabel+'の表示設定'}>
    <label className="check-label"><input type="checkbox" checked={currentOnly} onChange={e=>{if(e.target.checked&&!selected.length){setDraft(selected);setOpen(true);}else onToggle(e.target.checked);}}/>現在の{roleLabel}のみ{selected.length>0&&<span className="count-badge">{selected.length}人</span>}</label>
    <button className="roster-edit" onClick={()=>{setDraft(selected);setOpen(!open);setQuery('');}} aria-expanded={open}>表示する人を選択</button>
    {open&&<div className="roster-picker"><div className="roster-heading"><strong>表示する{roleLabel}を選択</strong><span>{draft.length}人選択中</span></div><p>現在の{roleLabel}{names.length}名から選択できます。表示の選択はこのブラウザに保存します。</p><div className="search-field"><Search size={16}/><input aria-label={roleLabel+'名を検索'} placeholder="名前で検索" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="roster-options">{shown.map(name=><label key={name} className="check-label"><input type="checkbox" checked={draft.includes(name)} onChange={e=>setDraft(e.target.checked?[...draft,name]:draft.filter(n=>n!==name))}/>{roleLabel==='\u30e9\u30a4\u30bf\u30fc'?writerLabel(name):name}</label>)}{!shown.length&&<p>該当する人はいません。</p>}</div><div className="roster-actions"><button onClick={()=>setDraft(names)}>全員を選択</button><button onClick={()=>setOpen(false)}>キャンセル</button><button className="primary-button" disabled={!draft.length} onClick={()=>{onChange(draft);onToggle(true);setOpen(false);}}>保存して絞り込む</button></div></div>}
  </div>;
}
