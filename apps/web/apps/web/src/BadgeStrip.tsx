import {BADGES} from '@nexo/shared/badges';
export default function BadgeStrip({ids=[]}:{ids?:string[]}){return <div className="badge-strip" aria-label="Insígnias do perfil">{ids.map(id=>{const b=BADGES.find(b=>b.id===id);return b?<span key={id} tabIndex={0} title={b.name+' · '+b.description} aria-label={b.name} style={{color:b.color}}>{b.icon}</span>:null;})}</div>;}
