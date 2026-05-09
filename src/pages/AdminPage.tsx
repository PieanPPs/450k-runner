import React, { useState, useEffect, useCallback } from 'react';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

async function api(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${BASE}/api/adminpp${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  return res.json();
}

// sync endpoints ต้องการ auth ด้วย — ใช้ helper นี้แทน fetch ตรงๆ
async function syncApi(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${BASE}/api/sync${path}`, {
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
  { key:'daily',        label:'📆 รายวัน' },
  { key:'settings',     label:'⚙️ ตั้งค่าโครงการ' },
  { key:'participants', label:'👥 ผู้เข้าร่วม' },
  { key:'milestones',   label:'🏆 Milestones' },
  { key:'distances',    label:'🗺️ Distances' },
  { key:'preseason',    label:'📈 Pre-Season' },
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
  const [baselining, setBaselining] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [baselineStatus, setBaselineStatus] = useState<{ hasBaseline:boolean; baselineCount:number; seasonCount:number } | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [testKey, setTestKey] = useState('');
  const [testKm, setTestKm] = useState('5');
  const [testMsg, setTestMsg] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);

  const reload = () => {
    fetch(`${BASE}/api/summary`).then(r=>r.json()).then(setData);
    api('/sync-logs').then(setLogs);
    fetch(`${BASE}/api/sync/baseline-status`).then(r=>r.json()).then(setBaselineStatus);
    api('/participants').then(setParticipants);
  };
  useEffect(() => { reload(); }, []);

  const doSync = async () => {
    setSyncing(true); setSyncMsg('');
    const j = await syncApi('', { method:'POST' });
    setSyncing(false);
    setSyncMsg(j.ok ? `✅ sync ${j.synced}/${j.total} คน` : `❌ ${j.message}`);
    reload();
  };

  const doClosePreseason = async () => {
    const status = baselineStatus;
    if (!status) return;
    if (status.seasonCount === 0) {
      alert('ไม่มีข้อมูล Pre-Season — ยังไม่มีกิจกรรมที่บันทึกไว้ในช่วงนี้');
      return;
    }
    const confirmed = confirm(
      `🏁 ปิด Pre-Season และบันทึกสถิติ?\n\n` +
      `กิจกรรม ${status.seasonCount} รายการจะถูกบันทึกเป็น "Pre-Season" ใน Seasons\n` +
      `จากนั้นระบบจะ reset km ทุกคนเป็น 0 พร้อมเริ่ม Season จริง\n\n` +
      `ยืนยัน?`
    );
    if (!confirmed) return;
    setBaselining(true); setSyncMsg('');
    try {
      const j = await syncApi('/close-preseason', { method:'POST' });
      setSyncMsg(j.ok ? `✅ ${j.message}` : `❌ ${j.message}`);
    } catch(e) {
      setSyncMsg(`❌ เกิดข้อผิดพลาด: ${(e as Error).message}`);
    } finally {
      setBaselining(false);
      reload();
    }
  };

  const doBaseline = async () => {
    const alreadySet = baselineStatus?.hasBaseline;
    const hasSeasonData = (baselineStatus?.seasonCount ?? 0) > 0;
    const warningExtra = hasSeasonData
      ? `\n\n⚠️ ขณะนี้มี ${baselineStatus!.seasonCount} กิจกรรม season อยู่แล้ว — กด Baseline อีกครั้งจะ mark ทั้งหมดเป็น pre-season และ reset km เป็น 0!`
      : '';
    const msg = alreadySet
      ? `🔁 Baseline ถูกตั้งไปแล้ว (${baselineStatus!.baselineCount} กิจกรรม)${warningExtra}\n\nยืนยันจะตั้ง Baseline ใหม่?`
      : `📍 ตั้ง Baseline ก่อนเริ่ม Season?\n\nกิจกรรมทั้งหมดใน Strava feed ตอนนี้จะถูก mark เป็น "ก่อนฤดูกาล" และไม่นับ km\nกดตกลงเมื่อพร้อมเริ่ม Season จริงๆ`;
    if (!confirm(msg)) return;
    setBaselining(true); setSyncMsg('');
    const j = await syncApi('/baseline', { method:'POST' });
    setBaselining(false);
    setSyncMsg(j.ok ? `✅ ${j.message}` : `❌ ${j.message}`);
    reload();
  };

  const doAddTest = async () => {
    if (!testKey) { setTestMsg('❌ เลือก participant ก่อน'); return; }
    const j = await syncApi('/test-activity', {
      method:'POST',
      body: JSON.stringify({ strava_key: testKey, distance_km: parseFloat(testKm) || 5 }),
    });
    setTestMsg(j.ok ? `✅ ${j.message}` : `❌ ${j.message}`);
    reload();
  };

  const doDeleteTest = async () => {
    const j = await syncApi('/test-activity', { method:'DELETE' });
    setTestMsg(j.ok ? `🗑️ ${j.message}` : `❌ ${j.message}`);
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
      {/* Baseline status bar */}
      {baselineStatus && (
        <div style={{
          background: baselineStatus.hasBaseline ? '#0f2a1a' : '#1a1200',
          border: `1px solid ${baselineStatus.hasBaseline ? '#166534' : '#713f12'}`,
          borderRadius:12, padding:'12px 16px', marginBottom:16,
          display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
        }}>
          <span style={{ fontSize:18 }}>{baselineStatus.hasBaseline ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ color: baselineStatus.hasBaseline ? '#4ade80' : '#fbbf24', fontWeight:700, fontSize:13 }}>
              {baselineStatus.hasBaseline ? 'Baseline ถูกตั้งแล้ว' : 'ยังไม่ได้ตั้ง Baseline'}
            </div>
            <div style={{ color:'#888', fontSize:12 }}>
              Pre-season: <strong style={{color:'#94a3b8'}}>{baselineStatus.baselineCount}</strong> กิจกรรม
              &nbsp;|&nbsp;
              Season: <strong style={{color:'#60a5fa'}}>{baselineStatus.seasonCount}</strong> กิจกรรม
            </div>
          </div>
          {(baselineStatus.seasonCount > 0) && (
            <span style={{ marginLeft:'auto', background:'#1e3a5f', color:'#93c5fd', fontSize:11, padding:'4px 10px', borderRadius:20, fontFamily:'Sarabun' }}>
              มีข้อมูล season {baselineStatus.seasonCount} กิจกรรม — ห้ามกด Baseline อีก
            </span>
          )}
        </div>
      )}

      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        <button onClick={doSync} disabled={syncing || baselining}
          style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
          {syncing ? 'กำลัง Sync...' : '↻ Sync Strava'}
        </button>

        {/* ปุ่มหลัก: ปิด Pre-Season (มีข้อมูล) หรือ ตั้ง Baseline (ยังไม่มีข้อมูล) */}
        {(baselineStatus?.seasonCount ?? 0) > 0 ? (
          <button onClick={doClosePreseason} disabled={syncing || baselining}
            style={{ background:'linear-gradient(135deg,#065f46,#10b981)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
            {baselining ? 'กำลังบันทึก...' : '🏁 ปิด Pre-Season & บันทึก'}
          </button>
        ) : (
          <button onClick={doBaseline} disabled={syncing || baselining}
            style={{ background:'linear-gradient(135deg,#b45309,#f59e0b)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
            {baselining ? 'กำลังตั้ง Baseline...' : '📍 ตั้ง Baseline (ก่อนเริ่มแข่ง)'}
          </button>
        )}

        <button onClick={() => setShowTestPanel(p => !p)}
          style={{ background:'#1e2a3a', border:'1px solid #334155', borderRadius:10, padding:'10px 18px', color:'#94a3b8', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Sarabun' }}>
          🧪 {showTestPanel ? 'ซ่อนแผงทดสอบ' : 'แผงทดสอบ'}
        </button>
        {syncMsg && <span style={{ color: syncMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize:13 }}>{syncMsg}</span>}
      </div>

      {/* Test panel */}
      {showTestPanel && (
        <div style={{ background:'#0d1520', border:'1px dashed #334155', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ color:'#94a3b8', fontSize:13, fontWeight:700, marginBottom:12 }}>🧪 แผงทดสอบ (เฉพาะ dev — ไม่ใช่ข้อมูลจริง)</div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
            <select value={testKey} onChange={e=>setTestKey(e.target.value)}
              style={{ background:'#1e2a3a', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, fontFamily:'Sarabun' }}>
              <option value=''>— เลือก participant —</option>
              {participants.map((p:any) => (
                <option key={p.id} value={p.strava_key}>{p.name} ({p.strava_key})</option>
              ))}
            </select>
            <input type='number' value={testKm} onChange={e=>setTestKm(e.target.value)} placeholder='km'
              style={{ width:70, background:'#1e2a3a', border:'1px solid #334155', borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:13, textAlign:'center' }} />
            <span style={{ color:'#64748b', fontSize:12 }}>km</span>
            <button onClick={doAddTest}
              style={{ background:'#166534', border:'none', borderRadius:8, padding:'8px 16px', color:'#4ade80', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
              ➕ เพิ่ม Test Activity
            </button>
            <button onClick={doDeleteTest}
              style={{ background:'#7f1d1d', border:'none', borderRadius:8, padding:'8px 16px', color:'#fca5a5', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
              🗑️ ลบ Test ทั้งหมด
            </button>
          </div>
          <div style={{ color:'#64748b', fontSize:11, marginBottom:6 }}>
            วิธีใช้: กด "เพิ่ม Test Activity" → กด "↻ Sync Strava" → ดูว่า km เพิ่มขึ้นไหม → กด "ลบ Test ทั้งหมด" เมื่อเสร็จ
          </div>
          {testMsg && <div style={{ color: testMsg.startsWith('✅')||testMsg.startsWith('🗑️') ? '#4ade80' : '#f87171', fontSize:12 }}>{testMsg}</div>}
        </div>
      )}

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
        {inp('about_3_title','About การ์ด 3 หัวข้อ','')}
        {inp('about_3_body','About การ์ด 3 เนื้อหา','')}
        {inp('about_4_title','About การ์ด 4 หัวข้อ','')}
        {inp('about_4_body','About การ์ด 4 เนื้อหา','')}

        {/* Signature uploads */}
        <div style={{ borderTop:'1px solid #2a2a3e', marginTop:8, paddingTop:20 }}>
          <div style={{ color:'#a78bfa', fontSize:13, fontWeight:700, marginBottom:16 }}>✍️ ลายเซ็นบนเกียรติบัตร</div>
          {(['sig_director','sig_chair'] as const).map((key, i) => {
            const label = i===0 ? 'ลายเซ็น ผู้อำนวยการโรงเรียน' : 'ลายเซ็น ประธานโครงการ';
            const nameKey = i===0 ? 'sig_director_name' : 'sig_chair_name';
            const nameLabel = i===0 ? 'ชื่อ ผู้อำนวยการ' : 'ชื่อ ประธานโครงการ';
            return (
              <div key={key} style={{ marginBottom:20 }}>
                <label style={{ color:'#888', fontSize:12, display:'block', marginBottom:6 }}>{label}</label>
                {form[key] && (
                  <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                    <img src={form[key]} alt="sig" style={{ height:48, background:'white', borderRadius:6, padding:4 }} />
                    <button onClick={()=>setForm(f=>({...f,[key]:''}))}
                      style={{ background:'#2a1010', border:'none', borderRadius:6, padding:'4px 10px', color:'#f87171', fontSize:11, cursor:'pointer' }}>ลบ</button>
                  </div>
                )}
                <input type="file" accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setForm(f=>({...f,[key]: ev.target?.result as string}));
                    reader.readAsDataURL(file);
                  }}
                  style={{ display:'block', marginBottom:8, color:'#888', fontSize:12 }} />
                <div style={{ marginTop:4 }}>
                  <label style={{ color:'#666', fontSize:11, display:'block', marginBottom:3 }}>{nameLabel}</label>
                  <input value={form[nameKey]||''} onChange={e=>setForm(f=>({...f,[nameKey]:e.target.value}))} placeholder="ชื่อ-นามสกุล"
                    style={{ width:'100%', background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'6px 12px', color:'#e2e8f0', fontSize:12, boxSizing:'border-box' }} />
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={save}
          style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
          {saved ? '✅ บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}

// ─── Certificate PDF Generator (Canvas-based — ไม่ใช้ html2canvas) ────────────
async function generateCertificatePDF(name: string, km: string) {
  const { jsPDF } = await import('jspdf');

  // ---- โหลด settings + ลายเซ็น ----
  let sigDirectorName = '', sigChairName = '';
  let sigDirImg: HTMLImageElement | null = null;
  let sigChairImg: HTMLImageElement | null = null;

  const loadImg = (src: string): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = src;
      setTimeout(() => resolve(null), 5000);
    });
  };

  try {
    const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
    const s = await fetch(`${BASE_URL}/api/settings`).then(r => r.json());
    sigDirectorName = s.sig_director_name || '';
    sigChairName    = s.sig_chair_name    || '';
    [sigDirImg, sigChairImg] = await Promise.all([
      loadImg(s.sig_director || ''),
      loadImg(s.sig_chair    || ''),
    ]);
  } catch {}

  // รอ web fonts โหลดครบ
  await document.fonts.ready;
  await document.fonts.load('bold 28px "Bebas Neue"');
  await document.fonts.load('bold 20px Sarabun');

  // ---- สร้าง canvas ขนาด A4 portrait (794×1123 px ≈ 210×297 mm @ 96dpi) ----
  const W = 794, H = 1123;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const PINK   = '#e91e8c';
  const PINK2  = '#ff3399';
  const GOLD   = '#ffcc44';

  // ── พื้นหลัง dark ──
  ctx.fillStyle = '#0d0818';
  ctx.fillRect(0, 0, W, H);

  // glow กลาง
  const glow = ctx.createRadialGradient(W/2, H*0.38, 40, W/2, H*0.38, 380);
  glow.addColorStop(0, 'rgba(160,0,130,0.38)');
  glow.addColorStop(1, 'rgba(13,8,24,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // ── กรอบ pink ──
  ctx.strokeStyle = PINK; ctx.lineWidth = 2.5;
  ctx.strokeRect(12, 12, W-24, H-24);
  ctx.strokeStyle = 'rgba(233,30,140,0.28)'; ctx.lineWidth = 1;
  ctx.strokeRect(19, 19, W-38, H-38);

  const cx = W / 2;
  const fill = (t: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') => {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, y);
  };
  const hline = (x1: number, y: number, x2: number, color = PINK, lw = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  };

  // ── corner HUD brackets ──
  const corner = (ox: number, oy: number, fx: number, fy: number) => {
    const s = 52, c = PINK;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(fx, fy);
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(0, 0); ctx.lineTo(s, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(233,30,140,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, s*0.55); ctx.lineTo(0, s*0.2); ctx.lineTo(s*0.55, s*0.2); ctx.stroke();
    ctx.fillStyle = c;
    ctx.fillRect(s+5, -1, 12, 2);
    ctx.fillRect(-1, s+5, 2, 12);
    ctx.restore();
  };
  corner(12, 12,  1,  1);
  corner(W-12, 12, -1,  1);
  corner(12, H-12,  1, -1);
  corner(W-12, H-12, -1, -1);

  // ── แถบข้าง ──
  ctx.strokeStyle = 'rgba(233,30,140,0.5)'; ctx.lineWidth = 1.2;
  [[14, 90, 14, H-90],[W-14, 90, W-14, H-90]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });

  let y = 72;

  // ── Badge วงกลมบน ──
  ctx.beginPath(); ctx.arc(cx, y, 38, 0, Math.PI*2);
  ctx.strokeStyle = PINK; ctx.lineWidth = 2; ctx.stroke();
  const bdg = ctx.createRadialGradient(cx, y, 5, cx, y, 38);
  bdg.addColorStop(0, 'rgba(233,30,140,0.15)'); bdg.addColorStop(1, 'rgba(13,8,24,0.2)');
  ctx.fillStyle = bdg; ctx.fill();
  fill('🏃', cx, y+8, '28px serif', '#fff');
  fill("THE TEACHER'S", cx, y+22, '500 7px Sarabun,serif', PINK);
  fill('GAME', cx, y+32, '600 7px Sarabun,serif', PINK);

  // ── THE TEACHER'S GAME ──
  y += 76;
  fill('THE', cx, y, 'italic bold 36px "Bebas Neue",serif', '#e8e0ff');
  y += 64;
  const tg = ctx.createLinearGradient(cx-160, y-60, cx+160, y);
  tg.addColorStop(0, '#ff99dd'); tg.addColorStop(0.5, '#e91e8c'); tg.addColorStop(1, '#c2185b');
  ctx.font = 'bold 82px "Bebas Neue",serif'; ctx.fillStyle = tg; ctx.textAlign = 'center';
  ctx.fillText("TEACHER'S", cx, y);
  y += 58;
  fill('GAME', cx, y, 'bold 64px "Bebas Neue",serif', '#d4c8f0');
  y += 28;
  fill('>>> RUN TOGETHER, WIN TOGETHER <<<', cx, y, '600 13px Sarabun,serif', PINK2);

  // ── Thai title ──
  y += 38;
  ctx.font = 'bold 36px Sarabun,serif';
  ctx.fillStyle = PINK2; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,51,153,0.7)'; ctx.shadowBlur = 18;
  ctx.fillText('เกียรติบัตรแห่งความสำเร็จ', cx, y);
  ctx.shadowBlur = 0;

  y += 22;
  hline(cx-200, y, cx-12, 'rgba(233,30,140,0.5)');
  fill('CERTIFICATE OF ACHIEVEMENT', cx, y+5, '400 11px Sarabun,serif', 'rgba(255,255,255,0.7)');
  hline(cx+12, y, cx+200, 'rgba(233,30,140,0.5)');

  y += 24;
  fill('ขอมอบเกียรติบัตรฉบับนี้ไว้เพื่อแสดงว่า', cx, y, '400 14px Sarabun,serif', 'rgba(255,255,255,0.7)');

  // ── Name box ──
  y += 22;
  const bx = 80, bw = W - 160, bh = 76;
  ctx.strokeStyle = PINK; ctx.lineWidth = 2;
  ctx.strokeRect(bx, y, bw, bh);
  const nbg = ctx.createLinearGradient(bx, y, bx, y+bh);
  nbg.addColorStop(0, 'rgba(233,30,140,0.08)'); nbg.addColorStop(1, 'rgba(13,8,24,0.4)');
  ctx.fillStyle = nbg; ctx.fillRect(bx+1, y+1, bw-2, bh-2);
  fill(name, cx, y + 44, 'bold 26px Sarabun,serif', '#ffffff');
  fill(`วิ่ง ${km} กิโลเมตร`, cx, y + 66, '400 14px Sarabun,serif', PINK);

  // ── Body text ──
  y += bh + 28;
  fill('ได้เข้าร่วมกิจกรรม', cx, y, '400 14px Sarabun,serif', 'rgba(255,255,255,0.75)');
  y += 28;
  ctx.font = 'italic bold 26px "Bebas Neue",serif';
  ctx.fillStyle = PINK2; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,51,153,0.5)'; ctx.shadowBlur = 10;
  ctx.fillText("THE TEACHER'S GAME", cx, y);
  ctx.shadowBlur = 0;
  y += 22;
  fill('RUN CHALLENGE', cx, y, '600 14px Sarabun,serif', 'rgba(255,255,255,0.8)');
  y += 24;
  fill('และสามารถพิชิตเป้าหมายด้วยความมุ่งมั่น', cx, y, '400 13px Sarabun,serif', 'rgba(255,255,255,0.65)');
  y += 20;
  fill('ขอชื่นชมในความพยายามและความตั้งใจในการดูแลสุขภาพ', cx, y, '400 13px Sarabun,serif', 'rgba(255,255,255,0.65)');
  y += 20;
  fill('คุณคือ "ครูต้นแบบ" ที่ไม่หยุดพัฒนา', cx, y, '600 13px Sarabun,serif', GOLD);

  // ── เส้นคั่น ──
  y += 28;
  hline(cx-180, y, cx-14, 'rgba(233,30,140,0.4)', 1);
  fill('◆', cx, y+5, '12px serif', PINK);
  hline(cx+14, y, cx+180, 'rgba(233,30,140,0.4)', 1);

  // ── ลายเซ็น ──
  y += 42;
  if (sigDirImg) {
    const ih = 52, iw = Math.min(160, (sigDirImg.naturalWidth / sigDirImg.naturalHeight) * ih);
    try { ctx.drawImage(sigDirImg, cx - iw/2, y - ih, iw, ih); } catch {}
    y += 6;
  }
  hline(cx - 130, y, cx + 130, 'rgba(255,255,255,0.35)', 1);
  y += 24;
  if (sigDirectorName) {
    ctx.font = 'bold 20px Sarabun,serif';
    ctx.fillStyle = GOLD; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,204,68,0.5)'; ctx.shadowBlur = 8;
    ctx.fillText(sigDirectorName, cx, y);
    ctx.shadowBlur = 0;
    y += 22;
  }
  fill('ผู้อำนวยการโรงเรียนอนุสรณ์ศุภมาศ', cx, y, '400 13px Sarabun,serif', 'rgba(255,255,255,0.7)');

  // ---- สร้าง PDF A4 portrait ----
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
  pdf.save(`certificate_${name.replace(/\s+/g, '_')}.pdf`);
}

// ─── Participants ─────────────────────────────────────────
function Participants() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name:'', initials:'', age_group:'general' });
  const [newId, setNewId] = useState<number|null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
  const load = useCallback(() => api('/participants').then(setRows), []);
  useEffect(() => { load(); }, [load]);

  const handleGeneratePDF = async (r: any) => {
    setGenerating(r.id);
    try {
      await generateCertificatePDF(r.name, r.km);
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + (e as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const save = async () => {
    await api(`/participants/${editing.id}`, { method:'PUT', body: JSON.stringify({ name: editing.name, initials: editing.initials, age_group: editing.age_group || 'general' }) });
    setEditing(null); load();
  };

  const addNew = async () => {
    if (!newForm.name || !newForm.initials) { alert('กรุณากรอก ชื่อ และ Initials'); return; }
    const res = await api('/participants', { method:'POST', body: JSON.stringify(newForm) });
    if (res.ok) { setNewId(res.id); load(); }
    else alert(res.message || 'เกิดข้อผิดพลาด');
  };

  const del = async (id: number, name: string) => {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return;
    await api(`/participants/${id}`, { method:'DELETE' });
    load();
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h2 style={{ color:'#e2e8f0', margin:0 }}>ผู้เข้าร่วม ({rows.length} คน)</h2>
        <button onClick={()=>{ setAdding(true); setNewId(null); setNewForm({ name:'', initials:'', age_group:'general' }); }}
          style={{ background:'linear-gradient(135deg,#059669,#34d399)', border:'none', borderRadius:8, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>
          + เพิ่มผู้เข้าร่วม
        </button>
      </div>
      <div style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              {['ชื่อ','initials','km','กลุ่ม','Strava key',''].map(h=>(
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
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, fontWeight:600,
                    background: r.age_group==='senior' ? '#f59e0b22' : '#2a2a3e',
                    color: r.age_group==='senior' ? '#f59e0b' : '#555' }}>
                    {r.age_group==='senior' ? '👑 60+' : 'ทั่วไป'}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', color:'#555', fontSize:11 }}>{r.strava_key||'—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button onClick={()=>setEditing({...r})} style={{ background:'#2a2a3e', border:'none', borderRadius:6, padding:'4px 10px', color:'#a78bfa', fontSize:12, cursor:'pointer' }}>แก้</button>
                    <button
                      onClick={() => handleGeneratePDF(r)}
                      disabled={generating === r.id}
                      title="ออกเกียรติบัตร PDF"
                      style={{
                        background: 'linear-gradient(135deg,#c9a84c,#e8cc80)',
                        border:'none', borderRadius:6, padding:'4px 10px',
                        color: '#1a1200',
                        fontSize:12, cursor: generating === r.id ? 'wait' : 'pointer',
                        fontWeight:600, whiteSpace:'nowrap',
                        opacity: generating === r.id ? 0.6 : 1,
                      }}
                    >
                      {generating === r.id ? '⏳...' : '📜 PDF'}
                    </button>
                    <button onClick={()=>del(r.id,r.name)} style={{ background:'#2a1010', border:'none', borderRadius:6, padding:'4px 10px', color:'#f87171', fontSize:12, cursor:'pointer' }}>ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal แก้ไข */}
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
            <div style={{ marginBottom:12 }}>
              <label style={{ color:'#888', fontSize:12 }}>กลุ่มอายุ</label>
              <select value={editing.age_group || 'general'} onChange={e=>setEditing((prev:any)=>({...prev,age_group:e.target.value}))}
                style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }}>
                <option value="general">ทั่วไป</option>
                <option value="senior">👑 กลุ่ม 60+</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={save} style={{ flex:1, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>บันทึก</button>
              <button onClick={()=>setEditing(null)} style={{ flex:1, background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal เพิ่มผู้เข้าร่วม */}
      {adding && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:'#1e1e30', border:'1px solid #333', borderRadius:16, padding:28, width:380 }}>
            <div style={{ color:'#34d399', fontSize:15, fontWeight:700, marginBottom:16 }}>+ เพิ่มผู้เข้าร่วมใหม่</div>

            {!newId ? (
              <>
                {[['name','ชื่อ-นามสกุล'],['initials','Initials (2-3 ตัว)']].map(([k,l])=>(
                  <div key={k} style={{ marginBottom:12 }}>
                    <label style={{ color:'#888', fontSize:12 }}>{l}</label>
                    <input value={(newForm as any)[k]} onChange={e=>setNewForm(p=>({...p,[k]:e.target.value}))}
                      style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom:16 }}>
                  <label style={{ color:'#888', fontSize:12 }}>กลุ่มอายุ</label>
                  <select value={newForm.age_group} onChange={e=>setNewForm(p=>({...p,age_group:e.target.value}))}
                    style={{ display:'block', width:'100%', marginTop:4, background:'#0d0d1a', border:'1px solid #333', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, boxSizing:'border-box' }}>
                    <option value="general">ทั่วไป</option>
                    <option value="senior">👑 กลุ่ม 60+</option>
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={addNew} style={{ flex:1, background:'linear-gradient(135deg,#059669,#34d399)', border:'none', borderRadius:8, padding:'8px', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Sarabun' }}>สร้าง</button>
                  <button onClick={()=>setAdding(false)} style={{ flex:1, background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background:'#0d2010', border:'1px solid #059669', borderRadius:10, padding:14, marginBottom:16 }}>
                  <div style={{ color:'#34d399', fontSize:13, fontWeight:700, marginBottom:6 }}>✅ สร้างผู้เข้าร่วมแล้ว (id = {newId})</div>
                  <div style={{ color:'#888', fontSize:12 }}>ขั้นตอนต่อไป: กดลิงก์ด้านล่างเพื่อเชื่อมต่อ Strava</div>
                </div>
                <a
                  href={`${BASE_URL}/api/auth/strava?participant_id=${newId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', textAlign:'center', background:'linear-gradient(135deg,#fc4c02,#ff6b35)', borderRadius:10, padding:'10px 16px', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none', marginBottom:12, fontFamily:'Sarabun' }}>
                  🔗 เชื่อมต่อ Strava (id={newId})
                </a>
                <button onClick={()=>setAdding(false)} style={{ width:'100%', background:'#2a2a3e', border:'none', borderRadius:8, padding:'8px', color:'#888', cursor:'pointer', fontFamily:'Sarabun' }}>ปิด</button>
              </>
            )}
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

// ─── Pre-Season ───────────────────────────────────────────
function PreSeasonPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/preseason').then(d => { setRows(d); setLoading(false); });
  }, []);

  // รวบรวม months ทั้งหมดที่มีข้อมูล เรียงตามลำดับ
  const allMonths = Array.from(
    new Set(rows.flatMap(r => Object.keys(r.monthly || {})))
  ).sort();

  const MONTH_TH: Record<string,string> = {
    '01':'ม.ค.','02':'ก.พ.','03':'มี.ค.','04':'เม.ย.',
    '05':'พ.ค.','06':'มิ.ย.','07':'ก.ค.','08':'ส.ค.',
    '09':'ก.ย.','10':'ต.ค.','11':'พ.ย.','12':'ธ.ค.',
  };
  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return `${MONTH_TH[mo] || mo}\n${y.slice(2)}`;
  };

  const totalPre = rows.reduce((s,r) => s + r.preseason_km, 0);
  const totalSea = rows.reduce((s,r) => s + r.season_km, 0);
  const totalAll = rows.reduce((s,r) => s + r.total_km, 0);

  if (loading) return <div style={{ color:'#666', padding:40 }}>กำลังโหลด...</div>;

  return (
    <div>
      <h2 style={{ color:'#e2e8f0', marginBottom:4 }}>📈 Pre-Season Summary</h2>
      <p style={{ color:'#666', fontSize:13, marginBottom:20 }}>
        เปรียบเทียบ Pre-season + Season km กับ "This year" ใน Strava app ของแต่ละคน
      </p>

      {/* Summary cards */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        {[
          { label:'Pre-season รวม', val:`${Math.round(totalPre*10)/10} km`, color:'#f59e0b' },
          { label:'Season รวม',     val:`${Math.round(totalSea*10)/10} km`, color:'#a78bfa' },
          { label:'รวมทั้งหมด (= This year)', val:`${Math.round(totalAll*10)/10} km`, color:'#34d399' },
        ].map(c => (
          <div key={c.label} style={{ background:'#1e1e30', border:'1px solid #2a2a3e', borderRadius:12, padding:'14px 20px', flex:'1', minWidth:160 }}>
            <div style={{ color:'#666', fontSize:11, marginBottom:6 }}>{c.label}</div>
            <div style={{ color:c.color, fontSize:22, fontFamily:'Bebas Neue', letterSpacing:1 }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* ตารางรายคน */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #2a2a3e' }}>
              <th style={{ padding:'8px 12px', color:'#666', textAlign:'left', position:'sticky', left:0, background:'#1e1e30', zIndex:1 }}>ชื่อ</th>
              <th style={{ padding:'8px 12px', color:'#f59e0b', textAlign:'right', whiteSpace:'nowrap' }}>Pre-season</th>
              <th style={{ padding:'8px 12px', color:'#a78bfa', textAlign:'right', whiteSpace:'nowrap' }}>Season</th>
              <th style={{ padding:'8px 12px', color:'#34d399', textAlign:'right', whiteSpace:'nowrap' }}>รวม≈This year</th>
              {allMonths.map(m => (
                <th key={m} style={{ padding:'8px 8px', color:'#555', textAlign:'right', whiteSpace:'pre', lineHeight:1.3, fontSize:11 }}>
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom:'1px solid #161625' }}>
                <td style={{ padding:'8px 12px', color:'#e2e8f0', position:'sticky', left:0, background:'#0d0d1a' }}>{r.name}</td>
                <td style={{ padding:'8px 12px', color:'#f59e0b', textAlign:'right', fontFamily:'Bebas Neue', fontSize:15 }}>
                  {r.preseason_km > 0 ? `${r.preseason_km}` : '—'}
                </td>
                <td style={{ padding:'8px 12px', color:'#a78bfa', textAlign:'right', fontFamily:'Bebas Neue', fontSize:15 }}>
                  {r.season_km > 0 ? `${r.season_km}` : '—'}
                </td>
                <td style={{ padding:'8px 12px', color:'#34d399', textAlign:'right', fontFamily:'Bebas Neue', fontSize:15, fontWeight:700 }}>
                  {r.total_km}
                </td>
                {allMonths.map(m => (
                  <td key={m} style={{ padding:'8px 8px', textAlign:'right', color: r.monthly[m] ? '#c4b5fd' : '#2a2a3e' }}>
                    {r.monthly[m] ? r.monthly[m].toFixed(1) : '·'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:'2px solid #2a2a3e' }}>
              <td style={{ padding:'8px 12px', color:'#888', fontWeight:700 }}>รวม</td>
              <td style={{ padding:'8px 12px', color:'#f59e0b', textAlign:'right', fontFamily:'Bebas Neue', fontSize:15 }}>{Math.round(totalPre*10)/10}</td>
              <td style={{ padding:'8px 12px', color:'#a78bfa', textAlign:'right', fontFamily:'Bebas Neue', fontSize:15 }}>{Math.round(totalSea*10)/10}</td>
              <td style={{ padding:'8px 12px', color:'#34d399', textAlign:'right', fontFamily:'Bebas Neue', fontSize:16, fontWeight:700 }}>{Math.round(totalAll*10)/10}</td>
              {allMonths.map(m => {
                const s = rows.reduce((sum,r) => sum + (r.monthly[m]||0), 0);
                return <td key={m} style={{ padding:'8px 8px', textAlign:'right', color:'#888' }}>{s>0?s.toFixed(1):'·'}</td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop:16, padding:12, background:'#1a1208', border:'1px solid #f59e0b44', borderRadius:10, fontSize:12, color:'#f59e0b88' }}>
        💡 คอลัมน์ <strong style={{color:'#34d399'}}>"รวม≈This year"</strong> ควรตรงกับ Statistics → This year ใน Strava app ของแต่ละคน
        <br/>ถ้าตัวเลขต่างกัน = มีกิจกรรมที่ Club API ดึงไม่ได้ (เก่าเกิน 200 activities ของคลับ)
      </div>
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

// ─── Daily Report ─────────────────────────────────────────
function DailyReport() {
  const todayBkk = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).slice(0,10);
  const [date, setDate]   = useState(todayBkk);
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await api(`/daily?date=${d}`);
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const fmtPace = (distKm: number, elapsed: number) => {
    if (!distKm) return '—';
    const paceMin = (elapsed / 60) / distKm;
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin - m) * 60).toString().padStart(2,'0');
    return `${m}:${s} /km`;
  };
  const fmtTime = (elapsed: number) => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const totalKm = data?.activities?.filter((a:any)=>!a.is_baseline).reduce((s:number,a:any)=>s+a.distance_km,0) ?? 0;
  const runners = new Set(data?.activities?.filter((a:any)=>!a.is_baseline).map((a:any)=>a.strava_key)).size;

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:24, color:'#a78bfa', letterSpacing:2 }}>📆 รายงานรายวัน</div>
        <div style={{ color:'#666', fontSize:13, marginTop:2 }}>ตรวจสอบกิจกรรมรายวัน — ใช้ track ปัญหาย้อนหลัง</div>
      </div>

      <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
        {/* ── ซ้าย: รายชื่อวัน ── */}
        <div style={{ width:200, flexShrink:0 }}>
          <div style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #2a2a3e', fontSize:12, color:'#888', fontWeight:700 }}>
              วันที่มีข้อมูล ({data?.days?.length ?? 0} วัน)
            </div>
            <div style={{ maxHeight:520, overflowY:'auto' }}>
              {(data?.days ?? []).map((d:any) => (
                <div key={d.day} onClick={() => setDate(d.day)}
                  style={{ padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid #1a1a2e',
                    background: date===d.day ? '#2a1f4e' : 'transparent',
                    borderLeft: date===d.day ? '3px solid #a78bfa' : '3px solid transparent',
                    transition:'all 0.1s' }}>
                  <div style={{ fontSize:12, color: date===d.day ? '#a78bfa' : '#ccc', fontWeight: date===d.day ? 700 : 400 }}>{d.day}</div>
                  <div style={{ fontSize:11, color:'#666', marginTop:1 }}>
                    🏃 {d.runners} คน · {d.total_km} km · {d.count} กิจกรรม
                  </div>
                </div>
              ))}
              {(!data?.days?.length) && <div style={{ padding:16, color:'#444', fontSize:12 }}>ยังไม่มีข้อมูล</div>}
            </div>
          </div>
        </div>

        {/* ── ขวา: ตารางกิจกรรม ── */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* date picker + summary */}
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{ background:'#1a1a2e', border:'1px solid #333', borderRadius:8, padding:'7px 12px',
                color:'#e2e8f0', fontSize:13, fontFamily:'Sarabun' }} />
            <div style={{ display:'flex', gap:10 }}>
              {[
                { label:`${runners} คน`, icon:'🏃' },
                { label:`${Math.round(totalKm*10)/10} km`, icon:'📏' },
                { label:`${data?.activities?.filter((a:any)=>!a.is_baseline).length ?? 0} กิจกรรม`, icon:'⚡' },
              ].map(s=>(
                <div key={s.label} style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:8,
                  padding:'6px 12px', fontSize:13, color:'#ccc' }}>
                  {s.icon} {s.label}
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ color:'#666', padding:32, textAlign:'center' }}>กำลังโหลด...</div>
          ) : !data?.activities?.length ? (
            <div style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:12, padding:48, textAlign:'center', color:'#444' }}>
              ไม่มีกิจกรรมในวันที่ {date}
            </div>
          ) : (
            <div style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #2a2a3e', background:'#12122a' }}>
                    {['เวลา','ชื่อ','กิจกรรม','ระยะ','เวลาวิ่ง','Pace','สถานะ'].map(h=>(
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:'#888', fontWeight:600, fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.activities.map((a:any, i:number) => (
                    <tr key={i} style={{ borderBottom:'1px solid #1e1e2e',
                      background: a.is_baseline ? '#1a120a' : i%2===0 ? 'transparent' : '#141428' }}>
                      <td style={{ padding:'9px 12px', color:'#666', fontSize:11, whiteSpace:'nowrap' }}>
                        {a.first_seen?.slice(11,16) ?? '—'}
                      </td>
                      <td style={{ padding:'9px 12px', color:'#e2e8f0', fontWeight:600 }}>{a.name}</td>
                      <td style={{ padding:'9px 12px', color:'#aaa' }}>{a.activity_name || '—'}</td>
                      <td style={{ padding:'9px 12px', color: a.is_baseline ? '#888' : '#a78bfa', fontWeight:700 }}>
                        {Math.round(a.distance_km*100)/100} km
                      </td>
                      <td style={{ padding:'9px 12px', color:'#888' }}>{fmtTime(a.elapsed_time)}</td>
                      <td style={{ padding:'9px 12px', color:'#888' }}>{fmtPace(a.distance_km, a.elapsed_time)}</td>
                      <td style={{ padding:'9px 12px' }}>
                        {a.is_baseline
                          ? <span style={{ background:'#2a1a00', color:'#f59e0b', fontSize:10, padding:'2px 7px', borderRadius:4 }}>Baseline</span>
                          : <span style={{ background:'#0f2a1a', color:'#34d399', fontSize:10, padding:'2px 7px', borderRadius:4 }}>Season</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage]       = useState('dashboard');

  useEffect(() => {
    const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
    fetch(`${BASE_URL}/api/settings`)
      .then(r => r.json())
      .then((s: Record<string,string>) => {
        if (s.project_name) document.title = `${s.project_name} — Admin`;
      })
      .catch(() => {});
  }, []);

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
    daily:        <DailyReport />,
    settings:     <Settings />,
    participants: <Participants />,
    milestones:   <CrudList title="Milestones" endpoint="milestones" fields={MILESTONE_FIELDS} />,
    distances:    <CrudList title="Distances (เส้นทาง)" endpoint="distances" fields={DISTANCE_FIELDS} />,
    preseason:    <PreSeasonPage />,
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
