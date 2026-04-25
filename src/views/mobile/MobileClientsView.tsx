import React, { useState, useMemo } from 'react';
import { Icon, I } from '@/components/shared/Icons';
import { Tag } from '@/components/shared/StatusChip';
import { CUSTOMERS, initials, avIdx } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';

export default function MobileClientsView() {
  const { selectedBusiness } = useAppStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return CUSTOMERS.filter(c => {
      if (!c.biz.includes(selectedBusiness as any)) return false;
      if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.phone.includes(query)) return false;
      return true;
    }).sort((a, b) => b.visits - a.visits);
  }, [selectedBusiness, query]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Search header */}
      <div style={{ padding:'10px 14px', borderBottom:'var(--hair)', background:'var(--paper)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, background:'var(--cream)', border:'var(--hair)' }}>
          <Icon d={I.search} size={15} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cerca clients…"
            style={{ flex:1, border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:14, color:'var(--ink-900)' }} />
        </div>
      </div>

      {/* List */}
      <div className="scroll" style={{ flex:1, overflowY:'auto' }}>
        {filtered.map(c => {
          const hasAllergy = c.tags.includes('allergy');
          return (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:'var(--hair)', background:'transparent' }}>
              <span className={`avatar av-${avIdx(c.name)}`} style={{ width:38, height:38, fontSize:13 }}>{initials(c.name)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--ink-900)' }}>{c.name}</span>
                  {hasAllergy && <span style={{ fontSize:12 }}>⚠️</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:1, fontFamily:'var(--font-mono)' }}>{c.phone}</div>
                <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                  {c.tags.map(t => <Tag key={t} kind={t} />)}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span style={{ fontSize:11, color:'var(--ink-600)' }}>{c.visits} visites</span>
                <a href={`tel:${c.phone}`} style={{ display:'grid', placeItems:'center', width:32, height:32, background:'var(--ink-100)', borderRadius:8, color:'var(--ink-700)' }}>
                  <Icon d={I.phone} size={15} />
                </a>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 16px', color:'var(--ink-500)' }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:15 }}>Cap client trobat</div>
          </div>
        )}
        <div style={{ height:20 }} />
      </div>
    </div>
  );
}
