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

  const athleteMap = {};
  for (const activity of allActivities) {
    const isRun = activity.type === 'Run' || activity.sport_type === 'Run';
    if (!isRun) continue;

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

export function calcStats(activities, seasonStart) {
  const startDate = new Date(seasonStart);

  const inSeason = activities.filter(a => {
    const d = a.start_date_local || a.start_date;
    return d ? new Date(d) >= startDate : true;
  });

  const totalMeters = inSeason.reduce((s, a) => s + (a.distance || 0), 0);
  const km     = totalMeters / 1000;
  const steps  = Math.round(km * 1350);
  const streak = calcStreak(inSeason);
  const weeklyKm   = calcWeeklyKm(inSeason);
  const weeklyData = calcWeeklyData(inSeason, startDate);

  const activityCount = inSeason.length;
  return { km, steps, streak, weeklyKm, weeklyData, activityCount };
}

function calcStreak(activities) {
  if (activities.length === 0) return 0;
  const runDays = new Set(activities.map(a => {
    const d = a.start_date_local || a.start_date;
    return d ? d.slice(0, 10) : null;
  }).filter(Boolean));

  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (runDays.has(key)) { streak++; }
    else if (i === 0) { continue; }
    else { break; }
  }
  return streak;
}

function calcWeeklyKm(activities) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return activities
    .filter(a => { const d = a.start_date_local || a.start_date; return d && new Date(d) >= oneWeekAgo; })
    .reduce((s, a) => s + (a.distance || 0), 0) / 1000;
}

function calcWeeklyData(activities, seasonStart) {
  const weeks = {};
  for (const a of activities) {
    const d = a.start_date_local || a.start_date;
    if (!d) continue;
    const diffDays = Math.floor((new Date(d) - seasonStart) / 86400000);
    const weekNum  = Math.floor(diffDays / 7) + 1;
    if (weekNum < 1) continue;
    if (!weeks[weekNum]) weeks[weekNum] = { km: 0, steps: 0 };
    const distKm = (a.distance || 0) / 1000;
    weeks[weekNum].km    += distKm;
    weeks[weekNum].steps += Math.round(distKm * 1350);
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([w, d]) => ({ week: `สัปดาห์ ${w}`, km: Math.round(d.km * 10) / 10, steps: d.steps }));
}
