export function commentParts(text:string,duration:number):{text:string;seconds?:number}[]{
 const parts:{text:string;seconds?:number}[]=[];let last=0;
 const pattern=/(?<![\d:])(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?![\d:])/g;
 for(const m of text.matchAll(pattern)){
  const hours=Number(m[1]||0),minutes=Number(m[2]),seconds=Number(m[3]),at=hours*3600+minutes*60+seconds;
  if(seconds>=60||(m[1]&&minutes>=60)||at>duration)continue;
  parts.push({text:text.slice(last,m.index)},{text:m[0],seconds:at});last=m.index!+m[0].length;
 }
 parts.push({text:text.slice(last)});return parts;
}
