const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE  = 'https://www.strava.com/api/v3';

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      client_id    : process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type   : 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
}

/**
 * สร้าง strava_key จาก firstname + อักษรแรกของ lastname
 * เช่น firstname="Piean" lastname="PPs" หรือ "P." → key = "Piean_P"
 * ใช้ match ระหว่าง OAuth data กับ Club activities data
 */
export function makeStravaKey(firstname, lastname) {
  const fn = (firstname || '').trim();
  const ln = (lastname  || '').trim().replace(/\.$/,''); // strip trailing dot
  return `${fn}_${ln.slice(0,1)}`.toLowerCase();
}

/**
 * ดึง activities ทั้งหมดจาก Strava Club จัดกลุ่มตาม strava_key
 * Club API ไม่คืน athlete.id → ใช้ firstname+lastname[0] แทน
 */
export async function getClubActivitiesByAthlete(accessToken, clubId) {
  const allActivities = [];
  let page = 1;

  while (true) {
    const url = `${STRAVA_API_BASE}/clubs/${clubId}/activities?per_page=200&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Club activities fetch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allActivities.push(...data);
    if (data.length < 200) break;
    page++;
  }

  // ---- เงื่อนไขกรองกิจกรรม ----
  // Run:  กรองแค่ pace — ไม่บังคับระยะ/เวลา (รองรับวิ่งสั้น/run-walk intervals)
  // Walk: บังคับ pace + ระยะ + เวลา (ป้องกันนับเดินในห้อง/เปิดทิ้ง)
  const RUN_MIN_PACE  = 3.5;  // เร็วกว่านี้ = ขับรถ/ปั่นจักรยาน
  const RUN_MAX_PACE  = 30;   // ช้ากว่านี้ = เปิดทิ้งไว้
  const WALK_MIN_PACE = 8;    // เร็วกว่านี้ = วิ่งอยู่จริงๆ แต่กด Walk
  const WALK_MAX_PACE = 17;   // ช้ากว่านี้ = เปิดทิ้งไว้/เดินในห้อง

  const athleteMap = {};
  for (const activity of allActivities) {
    const isRun  = activity.type === 'Run'  || activity.sport_type === 'Run';
    const isWalk = activity.type === 'Walk' || activity.sport_type === 'Walk';
    if (!isRun && !isWalk) continue;

    const distKm = (activity.distance || 0) / 1000;
    const durMin = (activity.elapsed_time || 0) / 60;
    const pace   = distKm > 0 ? durMin / distKm : 999;

    if (isRun) {
      if (pace < RUN_MIN_PACE) continue;  // เร็วเกินไป (ขับรถ/ปั่น)
      if (pace > RUN_MAX_PACE) continue;  // ช้าเกินไป (เปิดทิ้งไว้)
    } else {
      // Walk: กรองแค่ pace — ไม่บังคับระยะ/เวลา เพราะกลุ่ม 60+ วิ่งได้ไม่นาน
      if (pace < WALK_MIN_PACE) continue;  // เร็วเกินไป (วิ่งอยู่)
      if (pace > WALK_MAX_PACE) continue;  // ช้าเกินไป (เปิดทิ้งไว้)
    }

    const fn  = (activity.athlete?.firstname || '').trim();
    const ln  = (activity.athlete?.lastname  || '').trim();
    if (!fn) continue;

    const key = makeStravaKey(fn, ln);
    if (!athleteMap[key]) {
      athleteMap[key] = {
        stravaKey : key,
        stravaName: `${fn} ${ln}`.trim(),
        firstname : fn,
        lastname  : ln,
        activities: [],
      };
    }
    athleteMap[key].activities.push(activity);
  }

  return athleteMap;
}

// หมายเหตุ: calcStats/calcStreak/calcWeeklyKm/calcWeeklyData ถูกลบออก
// เพราะ Strava Club API ไม่ส่งวันที่ — sync route ใช้ first_seen จาก DB แทน
