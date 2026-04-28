import { useState, useEffect, useCallback } from 'react';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

async function api(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${BASE}/api/adminpp${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  return res.json();
}

// ─── Login ────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const res = await api('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    setLoading(false);
    if (res.ok) { localStorage.setItem('adminToken', res.token); onLogin(); }
    else setErr(res.message || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d1a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Sarabun' }}>
      <div style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:20, padding:40, width:360 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:'Bebas Neue', fontSize:28, color:'#a78bfa', letterSpacing:3 }}>450K ADMIN</div>
          <div style={{ color:'#666', fontSize:13, marginTop:4 }}>Teacher's Spirit Dashboard</div>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#999', fontSize:12, display:'block', marginBottom:6 }}>USERNAME</label>
            <input value={u} onChange={e=>setU(e.target.value)} placeholder="ชื่อผู้ใช้"
              style={{ width:'100%', background:'#0d0d1a', border:'1px solid #333', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:14, boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ color:'#999', fontSize:12, display:'block', marginBottom:6 }}>PASSWORD</label>
            <input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="รหัสผ่าน"
              style={{ width:'100%', background:'#0d0d1a', border:'1px solid #333', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:14, boxSizing:'border-box' }} />
          </div>
          {err && <div style={{ color:'#f87171', fontSize:13, marginBottom:16, textAlign:'center' }}>{err}</div>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:10, padding:'12px', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────
const MENUS = [
  { key:'dashboard',    label:'📊 ภาพรวม' },
  { key:'settings',     label:'⚙️ ตั้งค่าโครงการ' },
  { key:'participants', label:'👥 ผู้เข้าร่วม' },
  { key:'milestones',   label:'🏆 Milestones' },
  { key:'distances',    label:'🗺️ Distances' },
  { key:'seasons',      label:'📅 Seasons' },
  { key:'gallery',      label:'🖼️ Gallery' },
  { key:'export',       label:'📤 Export' },
];

function Sidebar({ active, onSelect, onLogout }: { active:string; onSelect:(k:string)=>void; onLogout:()=>void }) {
  return (
    <div style={{ width:200, background:'#1a1a2e', borderRight:'1px solid #2a2a3e', display:'flex', flexDirection:'column', minHeight:'100vh', flexShrink:0 }}>
      <div style={{ padding:'20px 16px', borderBottom:'1px solid #2a2a3e' }}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:16, color:'#a78bfa', letterSpacing:2 }}>450K ADMIN</div>
        <div style={{ color:'#666', fontSize:11, marginTop:2 }}>ppiean.com</div>
      </div>
      <div style={{ flex:1, padding:'8px 0' }}>
        {MENUS.map(m => (
          <div key={m.key} onClick={() => onSelect(m.key)}
            style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, color: active===m.key ? '#a78bfa' : '#888',
              background: active===m.key ? '#2a1f4e' : 'transparent',
              borderLeft: active===m.key ? '3px solid #a78bfa' : '3px solid transparent',
              transition:'all 0.15s' }}>
            {m.label}
          </div>
        ))}
      </div>
      <div style={{ padding:'12px 16px', borderTop:'1px solid #2a2a3e' }}>
        <button onClick={onLogout} style={{ background:'none', border:'1px solid #333', borderRadius:8, padding:'6px 12px', color:'#666', fontSize:12, cursor:'pointer', width:'100%', fontFamily:'Sarabun' }}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────
function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const reload = () => {
    fetch(`${BASE}/api/summary`).then(r=>r.json()).then(setData);
    api('/sync-logs').then(setLogs);
  };
  useEffect(() => { reload(); }, []);

  const doSync = async () => {
    setSyncing(true); setSyncMsg('');
    const res = await fetch(`${BASE}/api/sync`, { method:'POST' });
    const j = await res.json();
    setSyncing(false);
    setSyncMsg(j.ok ? `✅ sync ${j.synced}/${j.total} คน` : `❌ ${j.message}`);
    reload();
  };

  const card = (label: string, value: string|number, unit: string, color='#a78bfa') => (
    <div key={label} style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, padding:'16px 20px' }}>
      <div style={{ color:'#666', fontSize:11, marginBottom:4 }}>{label}</div>
      <div style={{ color, fontFamily:'Bebas Neue', fontSize:26, letterSpacing:1 }}>
        {value ?? '—'} <span style={{ fontSize:12, color:'#888', fontFamily:'Sarabun' }}>{unit}</span>
      </div>
    </div>
  );

  const s: React.CSSProperties = { background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, padding:'16px 20px' };
  return (
    <div>
      <h2 style={{ color:'#e2e8f0', marginBottom:20 }}>ภาพรวม</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {card('ผู้เข้าร่วม',   data?.participantCount ?? '—', 'คน', '#a78bfa')}
        {card('km รวม',        data?.totalKm          ?? '—', 'km', '#60a5fa')}
        {card('km สัปดาห์นี้', data?.totalWeeklyKm    ?? '—', 'km', '#34d399')}
        {card('กิจกรรมรวม',   data?.totalActivities  ?? '—', 'ครั้ง','#fb923c')}
        {card('เป้าหมาย',     data?.goalKm            ?? '—', 'km', '#f472b6')}
        {card('ความคืบหน้า',  data?.pct != null ? data.pct.toFixed(1) : '—', '%', '#facc15')}
      </div>
      {data?.topName && data.topName !== '—' && (
        <div style={{ ...s, marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>🏆</span>
          <div>
            <div style={{ color:'#666', fontSize:11 }}>นำอยู่ตอนนี้</div>
            <div style={{ color:'#fbbf24', fontWeight:700 }}>{data.topName} — {data.topKm} km</div>
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:24 }}>
        <button onClick={doSync} disabled={syncing}
          style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
          {syncing ? 'กำลัง Sync...' : '↻ Sync Strava'}
        </button>
        {syncMsg && <span style={{ color: syncMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize:13 }}>{syncMsg}</span>}
      </div>
      <div style={s}>
        <div style={{ color:'#a78bfa', fontSize:13, fontWeight:700, marginBottom:12 }}>Sync Log ล่าสุด</div>
        {logs.length === 0 && <div style={{ color:'#555', fontSize:12 }}>ยังไม่มี log</div>}
        {logs.map(l => (
          <div key={l.id} style={{ display:'flex', gap:16, padding:'6px 0', borderBottom:'1px solid #2a2a3e', fontSize:12 }}>
            <span style={{ color:'#555', minWidth:140 }}>{l.synced_at}</span>
            <span style={{ color: l.status==='ok' ? '#4ade80' : '#fb923c' }}>{l.status}</span>
            <span style={{ color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────
function Settings() {
  const [form, setForm] = useState<Record<string,string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { api('/settings').then(setForm); }, []);

  const save = async () => {
    await api('/settings', { method:'PUT', body: JSON.stringify(form) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const inp = (key: string, label: string, placeholder='') => (
    <div style={{ marginBottom:16 }}>
      <label style={{ color:'#888', fontSize:12, display:'block', marginBottom:4 }}>{label}</label>
      <input value={form[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={placeholder}
        style={{ width:'100%', background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
    </div>
  );

  return (
    <div style={{ maxWidth:560 }}>
      <h2 style={{ color:'#e2e8f0', marginBottom:20 }}>ตั้งค่าโครงการ</h2>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, padding:24 }}>
        {inp('project_name','ชื่อโครงการ','450K TEACHER\'S SPIRIT')}
        {inp('project_subtitle','คำอธิบายสั้น','ก้าวนี้เพื่อเด็ก ก้าวนี้เพื่อเรา')}
        {inp('season_start','วันเริ่มต้น (YYYY-MM-DD)','2026-06-01')}
        {inp('season_end','วันสิ้นสุด (YYYY-MM-DD)','2026-09-30')}
        {inp('goal_km_per_person','เป้าหมาย km/คน','450')}
        {inp('strava_club_id','Strava Club ID','2086686')}
        {inp('about_1_title','About การ์ด 1 หัวข้อ','วัตถุประสงค์')}
        {inp('about_1_body','About การ์ด 1 เนื้อหา','')}
        {inp('about_2_title','About การ์ด 2 หัวข้อ','เพื่อครู เพื่อเด็ก')}
        {inp('about_2_body','About การ์ด 2 เนื้อหา','')}
        <button onClick={save}
          style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
          {saved ? '✅ บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}

// ─── Participants ─────────────────────────────────────────
function Participants() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const load = useCallback(() => api('/participants').then(setRows), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    await api(`/participants/${editing.id}`, { method:'PUT', body: JSON.stringify({ name: editing.name, initials: editing.initials }) });
    setEditing(null); load();
  };

  const del = async (id: number, name: string) => {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return;
    await api(`/participants/${id}`, { method:'DELETE' });
    load();
  };

  return (
    <div>
      <h2 style={{ color:'#e2e8f0', marginBottom:20 }}>ผู้เข้าร่วม ({rows.length} คน)</h2>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {['ชื่อ','initials','km','Strava key',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', color:'#666', fontWeight:500, textAlign:'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid #1a1a2e' }}>
                <td style={{ padding:'10px 14px', color:'#e2e8f0' }}>{r.name}</td>
                <td style={{ padding:'10px 14px', color:'#888' }}>{r.initials}</td>
                <td style={{ padding:'10px 14px', color:'#a78bfa', fontFamily:'Bebas Neue', fontSize:16 }}>{r.km}</td>
                <td style={{ padding:'10px 14px', color:'#555', fontSize:11 }}>{r.strava_key||'—'}</td>
                <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                  <button onClick={()=>setEditing({...r})} style={{ background:'#2a2a3e', border:'none', borderRadius:6, padding:'4px 10px', color:'#a78bfa', fontSize:12, cursor:'pointer' }}>แก้</button>
                  <button onClick={()=>del(r.id,r.name)} style={{ background:'#2a1010', border:'none', borderRadius:6, padding:'4px 10px', color:'#f87171', fontSize:12, cursor:'pointer' }}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:'#1e1e30', border:'1px solid #333', borderRadius:16, padding:28, width:340 }}>
            <div style={{ color:'#a78bfa', fontSize:15, fontWeight:700, marginBottom:16 }}>แก้ไขผู้เข้าร่วม</div>
            {[['name','ชื่อ'],['initials','Initials']].map(([k,l])=>(
              <div key={k} style={{ marginBottom:12 }}>
                <label style={{ color:'#888', fontSize:12 }}>{l}</label>
                <input value={editing[k]} onChange={e=>setEditing((prev: any)=>({...prev,[k]:e.target.value}))}
                  style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={save} style={{ flex:1, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>บันทึก</button>
              <button onClick={()=>setEditing(null)} style={{ flex:1, background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generic CRUD List ────────────────────────────────────
function CrudList({ title, endpoint, fields }: { title:string; endpoint:string; fields:{key:string;label:string;type?:string}[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [editId, setEditId] = useState<number|null>(null);
  const load = useCallback(() => api(`/${endpoint}`).then(setRows), [endpoint]);
  useEffect(() => { load(); }, [load]);

  const startEdit = (r: any) => { setEditId(r.id); setForm({...r}); };
  const startNew  = () => { setEditId(-1); setForm({}); };
  const cancel    = () => { setEditId(null); setForm({}); };

  const save = async () => {
    if (editId === -1) await api(`/${endpoint}`, { method:'POST', body:JSON.stringify(form) });
    else await api(`/${endpoint}/${editId}`, { method:'PUT', body:JSON.stringify(form) });
    cancel(); load();
  };

  const del = async (id: number) => {
    if (!confirm('ลบรายการนี้?')) return;
    await api(`/${endpoint}/${id}`, { method:'DELETE' }); load();
  };

  const btnStyle = (color='#a78bfa'): React.CSSProperties => ({ background:'#2a2a3e', border:'none', borderRadius:6, padding:'4px 10px', color, fontSize:12, cursor:'pointer' });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ color:'#e2e8f0' }}>{title}</h2>
        <button onClick={startNew} style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>+ เพิ่ม</button>
      </div>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {fields.map(f=><th key={f.key} style={{ padding:'10px 14px', color:'#666', fontWeight:500, textAlign:'left' }}>{f.label}</th>)}
              <th style={{ padding:'10px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} style={{ borderBottom:'1px solid #1a1a2e' }}>
                {fields.map(f=><td key={f.key} style={{ padding:'10px 14px', color:'#e2e8f0' }}>{r[f.key]}</td>)}
                <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                  <button onClick={()=>startEdit(r)} style={btnStyle()}>แก้</button>
                  <button onClick={()=>del(r.id)} style={btnStyle('#f87171')}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editId !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:'#1e1e30', border:'1px solid #333', borderRadius:16, padding:28, width:380, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ color:'#a78bfa', fontSize:15, fontWeight:700, marginBottom:16 }}>{editId===-1?'เพิ่มใหม่':'แก้ไข'}</div>
            {fields.map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ color:'#888', fontSize:12 }}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]||''} onChange={e=>setForm((p:any)=>({...p,[f.key]:e.target.value}))}
                  style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={save} style={{ flex:1, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>บันทึก</button>
              <button onClick={cancel} style={{ flex:1, background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────
function ExportPage() {
  const doExport = async () => {
    const token = localStorage.getItem('adminToken');
    const res = await fetch(`${BASE}/api/adminpp/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '450k-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  const doReset  = async () => {
    if (!confirm('⚠️ รีเซ็ตข้อมูลการวิ่งทั้งหมด? (ผู้เข้าร่วมยังอยู่)')) return;
    const res = await api('/reset', { method:'POST' });
    alert(res.message);
  };
  return (
    <div style={{ maxWidth:500 }}>
      <h2 style={{ color:'#e2e8f0', marginBottom:20 }}>Export & จัดการข้อมูล</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <button onClick={doExport} style={{ background:'linear-gradient(135deg,#0f766e,#14b8a6)', border:'none', borderRadius:10, padding:'12px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun', textAlign:'left' }}>
          📥 Export ข้อมูลทั้งหมด (.csv)
        </button>
        <button onClick={doReset} style={{ background:'#2a1010', border:'1px solid #7f1d1d', borderRadius:10, padding:'12px 24px', color:'#f87171', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun', textAlign:'left' }}>
          ⚠️ Reset ข้อมูลการวิ่ง (ระวัง)
        </button>
      </div>
    </div>
  );
}

// ─── Seasons with auto-compute ────────────────────────────
function SeasonsPage() {
  const SEASON_FIELDS = [
    { key:'name', label:'ชื่อ Season' },
    { key:'subtitle', label:'Subtitle' },
    { key:'date_range', label:'ช่วงเวลา' },
    { key:'status', label:'สถานะ (done/active/upcoming)' },
    { key:'winner', label:'ผู้ชนะ' },
    { key:'total_km', label:'km รวม', type:'number' },
    { key:'top_km', label:'Best km (คน)', type:'number' },
    { key:'participants', label:'จำนวนผู้เข้าร่วม', type:'number' },
  ];
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [editId, setEditId] = useState<number|null>(null);
  const [computing, setComputing] = useState(false);
  const load = useCallback(() => api('/seasons').then(setRows), []);
  useEffect(() => { load(); }, [load]);

  const startEdit = (r: any) => { setEditId(r.id); setForm({...r}); };
  const startNew  = () => { setEditId(-1); setForm({ status:'active' }); };
  const cancel    = () => { setEditId(null); setForm({}); };

  const autoFill = async () => {
    setComputing(true);
    const res = await api('/seasons/compute');
    setForm((f: any) => ({ ...f, ...res }));
    setComputing(false);
  };

  const save = async () => {
    if (editId === -1) await api('/seasons', { method:'POST', body:JSON.stringify(form) });
    else await api(`/seasons/${editId}`, { method:'PUT', body:JSON.stringify(form) });
    cancel(); load();
  };

  const del = async (id: number) => {
    if (!confirm('ลบ Season นี้?')) return;
    await api(`/seasons/${id}`, { method:'DELETE' }); load();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ color:'#e2e8f0' }}>Seasons</h2>
        <button onClick={startNew} style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>+ เพิ่ม Season</button>
      </div>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {['ชื่อ','ช่วงเวลา','สถานะ','km รวม','ผู้ชนะ',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', color:'#666', fontWeight:500, textAlign:'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} style={{ borderBottom:'1px solid #1a1a2e' }}>
                <td style={{ padding:'10px 14px', color:'#e2e8f0' }}>{r.name}</td>
                <td style={{ padding:'10px 14px', color:'#888', fontSize:11 }}>{r.date_range}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background: r.status==='active'?'#4ade8022':r.status==='done'?'#60a5fa22':'#88888822',
                    color: r.status==='active'?'#4ade80':r.status==='done'?'#60a5fa':'#888',
                    borderRadius:999, padding:'2px 10px', fontSize:11 }}>{r.status}</span>
                </td>
                <td style={{ padding:'10px 14px', color:'#a78bfa', fontFamily:'Bebas Neue', fontSize:16 }}>{r.total_km} km</td>
                <td style={{ padding:'10px 14px', color:'#fbbf24' }}>{r.winner}</td>
                <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                  <button onClick={()=>startEdit(r)} style={{ background:'#2a2a3e', border:'none', borderRadius:6, padding:'4px 10px', color:'#a78bfa', fontSize:12, cursor:'pointer' }}>แก้</button>
                  <button onClick={()=>del(r.id)} style={{ background:'#2a1010', border:'none', borderRadius:6, padding:'4px 10px', color:'#f87171', fontSize:12, cursor:'pointer' }}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editId !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:'#1e1e30', border:'1px solid #333', borderRadius:16, padding:28, width:400, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ color:'#a78bfa', fontSize:15, fontWeight:700, marginBottom:8 }}>{editId===-1?'เพิ่ม Season':'แก้ไข Season'}</div>
            <button onClick={autoFill} disabled={computing}
              style={{ width:'100%', marginBottom:16, background:'#0f766e', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
              {computing ? 'กำลังดึงข้อมูล...' : '📊 ดึงสถิติจากข้อมูลจริง (auto-fill)'}
            </button>
            {SEASON_FIELDS.map(f=>(
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ color:'#888', fontSize:12 }}>{f.label}</label>
                <input type={f.type||'text'} value={form[f.key]||''} onChange={e=>setForm((p:any)=>({...p,[f.key]:e.target.value}))}
                  style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={save} style={{ flex:1, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>บันทึก</button>
              <button onClick={cancel} style={{ flex:1, background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gallery Management ───────────────────────────────────
function GalleryAdmin() {
  const [images, setImages] = useState<any[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api('/gallery').then(setImages), []);
  useEffect(() => { load(); }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      const res = await api('/gallery', {
        method:'POST',
        body: JSON.stringify({ filename: file.name, data, caption }),
      });
      setUploading(false);
      if (res.ok) { setMsg('✅ อัปโหลดสำเร็จ'); setCaption(''); load(); }
      else setMsg('❌ ' + (res.message || 'error'));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const del = async (id: number) => {
    if (!confirm('ลบภาพนี้?')) return;
    await api(`/gallery/${id}`, { method:'DELETE' });
    load();
  };

  return (
    <div>
      <h2 style={{ color:'#e2e8f0', marginBottom:20 }}>จัดการ Gallery</h2>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, padding:20, marginBottom:24 }}>
        <div style={{ color:'#a78bfa', fontSize:13, fontWeight:700, marginBottom:12 }}>📤 อัปโหลดภาพใหม่</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="คำอธิบายภาพ (ไม่บังคับ)"
            style={{ flex:1, minWidth:200, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13 }} />
          <label style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', borderRadius:10, padding:'9px 20px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {uploading ? 'กำลังอัปโหลด...' : '📁 เลือกไฟล์'}
            <input type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} disabled={uploading} />
          </label>
        </div>
        {msg && <div style={{ marginTop:10, color: msg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize:13 }}>{msg}</div>}
      </div>
      {images.length === 0 ? (
        <div style={{ color:'#555', textAlign:'center', padding:40 }}>ยังไม่มีภาพ</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
          {images.map(img => (
            <div key={img.id} style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:12, overflow:'hidden' }}>
              <img src={`${BASE}/gallery/${img.filename}`} alt={img.caption}
                style={{ width:'100%', height:140, objectFit:'cover', display:'block' }} />
              <div style={{ padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:'#888', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                  {img.caption || img.filename}
                </span>
                <button onClick={() => del(img.id)} style={{ background:'#2a1010', border:'none', borderRadius:6, padding:'3px 8px', color:'#f87171', fontSize:11, cursor:'pointer', flexShrink:0, marginLeft:6 }}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage]       = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { setChecking(false); return; }
    api('/verify').then(r => { setAuthed(r.ok); setChecking(false); });
  }, []);

  const logout = () => { localStorage.removeItem('adminToken'); setAuthed(false); };

  if (checking) return <div style={{ minHeight:'100vh', background:'#0d0d1a', display:'flex', alignItems:'center', justifyContent:'center', color:'#666', fontFamily:'Sarabun' }}>กำลังโหลด...</div>;
  if (!authed)  return <LoginPage onLogin={() => setAuthed(true)} />;

  const MILESTONE_FIELDS = [
    { key:'km', label:'km', type:'number' },
    { key:'reward', label:'รางวัล' },
    { key:'icon', label:'Icon (emoji)' },
    { key:'color', label:'Color (#hex)' },
    { key:'bg', label:'Background (#hex หรือ rgba)' },
  ];
  const DISTANCE_FIELDS = [
    { key:'km', label:'km', type:'number' },
    { key:'label', label:'ชื่อเมือง' },
    { key:'icon', label:'Icon (emoji)' },
    { key:'description', label:'คำอธิบาย' },
    { key:'gmap_url', label:'Google Maps URL' },
  ];
  const content: Record<string, React.ReactNode> = {
    dashboard:    <Dashboard />,
    settings:     <Settings />,
    participants: <Participants />,
    milestones:   <CrudList title="Milestones" endpoint="milestones" fields={MILESTONE_FIELDS} />,
    distances:    <CrudList title="Distances (เส้นทาง)" endpoint="distances" fields={DISTANCE_FIELDS} />,
    seasons:      <SeasonsPage />,
    gallery:      <GalleryAdmin />,
    export:       <ExportPage />,
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0d0d1a', fontFamily:'Sarabun', color:'#e2e8f0' }}>
      <Sidebar active={page} onSelect={setPage} onLogout={logout} />
      <div style={{ flex:1, padding:28, overflowY:'auto' }}>
        {content[page]}
      </div>
    </div>
  );
}
