# 🏗️ Architecture — 450K Runner Backend

> อัพเดทล่าสุด: พฤษภาคม 2026  
> ใช้ไฟล์นี้เป็น reference เวลาพัฒนาต่อ หรือแก้ bug

---

## 📁 โครงสร้างไฟล์ Backend

```
backend/
├── src/
│   ├── server.js                  ← Entry point: Express app + Cron jobs
│   ├── db/
│   │   ├── schema.sql             ← สร้างตาราง DB ทั้งหมด (idempotent)
│   │   ├── connection.js          ← เชื่อมต่อ SQLite (better-sqlite3)
│   │   └── seed-data.js           ← ข้อมูลตัวอย่างสำหรับ dev
│   ├── lib/
│   │   ├── season.js              ← ช่วงวัน season, baselineFlagFor, currentSeasonId
│   │   ├── seasonLifecycle.js     ← ปิด/เริ่ม/ตั้งเวลา season + cron lifecycle + weekly snapshot
│   │   └── backup.js              ← autoBackup()
│   ├── middleware/
│   │   └── adminAuth.js           ← JWT สำหรับ admin (signToken, requireAdmin)
│   ├── strava/
│   │   └── client.js              ← Strava API: refresh token, ดึง Club activities
│   ├── controllers/
│   │   └── dashboardController.js ← Logic สำหรับ public endpoints ทั้งหมด
│   └── routes/
│       ├── dashboard.js           ← Public routes (ไม่ต้อง auth)
│       ├── sync.js                ← Sync routes (POST / = public, ที่เหลือ requireAdmin)
│       ├── admin.js               ← Admin routes (requireAdmin ทั้งหมด)
│       └── auth.js                ← Strava OAuth routes
├── data/
│   ├── 450k.sqlite                ← ฐานข้อมูลจริง (อย่า commit!)
│   ├── backups/                   ← auto-backup ก่อนทุก sync + daily 23:59
│   └── gallery/                   ← รูปภาพ gallery ที่ upload จาก admin
├── .env                           ← ค่าลับ (อย่า commit!)
└── Dockerfile
```

---

## 🗄️ Database Tables

| ตาราง | หน้าที่ | หมายเหตุ |
|-------|---------|---------|
| `participants` | ผู้เข้าร่วมทั้งหมด | km, steps, streak, weekly_km คำนวณตอน sync |
| `strava_activities` | ทุก activity ที่ sync มา | เก็บถาวร ไม่ลบแม้ Strava ลบต้นฉบับ |
| `strava_tokens` | OAuth token ของคนที่ connect Strava | refresh อัตโนมัติตอน sync |
| `project_settings` | ค่าตั้งโครงการ (season_start ฯลฯ) | แก้ได้จาก Admin UI |
| `sync_log` | log ทุกครั้งที่ sync | เก็บ 20 รายการล่าสุด |
| `weekly_snapshots` | snapshot ทุกวันอาทิตย์ 23:59 | สำหรับ "ผลย้อนหลัง" |
| `weekly_data` | สรุป km รายสัปดาห์ (กราฟ) | rebuild ทุก sync |
| `milestones` | เป้าหมายระยะทาง (badge) | แก้ได้จาก Admin |
| `distances` | เส้นทาง Journey map | แก้ได้จาก Admin |
| `seasons` | ข้อมูล season ย้อนหลัง | แก้ได้จาก Admin |
| `gallery_images` | รายชื่อรูปภาพ gallery | upload จาก Admin |

### คอลัมน์สำคัญใน `strava_activities`

```sql
strava_key    -- firstname_L (เช่น "piean_p") — ผูกกับ participants
activity_hash -- strava_key|distance|elapsed_time|name — ป้องกัน duplicate
first_seen    -- วันที่วิ่งจริง (start_date_local จาก Strava)
is_baseline   -- 0=season (นับ km), 1=pre-season (ไม่นับ km)
```

---

## 🔌 API Routes

### Public (ไม่ต้อง auth)
| Method | Path | หน้าที่ |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/summary` | รวม km, goal, pct |
| GET | `/api/participants` | รายชื่อผู้เข้าร่วมทั้งหมด |
| GET | `/api/leaderboard?metric=km` | เรียงอันดับ |
| GET | `/api/weekly` | ข้อมูลกราฟรายสัปดาห์ |
| GET | `/api/weekly-snapshots` | ผลย้อนหลังรายสัปดาห์ |
| GET | `/api/seasons` | รายการ season |
| GET | `/api/distances` | เส้นทาง Journey |
| GET | `/api/milestones` | Milestones / badges |
| GET | `/api/gallery` | รูปภาพ gallery |
| GET | `/api/settings` | ค่าตั้งโครงการ |
| GET | `/api/daily?date=YYYY-MM-DD` | กิจกรรมรายวัน |
| POST | `/api/sync` | **Trigger sync (public — ครูกดเองได้)** |
| GET | `/api/auth/strava` | เริ่ม Strava OAuth |
| GET | `/api/auth/callback` | OAuth callback |
| GET | `/api/auth/status` | สถานะการ connect |

### Admin (ต้องมี JWT token)
| Method | Path | หน้าที่ |
|--------|------|---------|
| POST | `/api/adminpp/login` | เข้าสู่ระบบ Admin |
| GET | `/api/adminpp/verify` | ตรวจสอบ token |
| GET/PUT | `/api/adminpp/settings` | ค่าตั้งโครงการ |
| GET/PUT/DELETE | `/api/adminpp/participants/:id` | จัดการผู้เข้าร่วม |
| GET/POST/PUT/DELETE | `/api/adminpp/milestones/:id` | จัดการ Milestones |
| GET/POST/PUT/DELETE | `/api/adminpp/distances/:id` | จัดการ Distances |
| GET/POST/PUT/DELETE | `/api/adminpp/seasons/:id` | จัดการ Seasons |
| GET/POST/DELETE | `/api/adminpp/gallery/:id` | จัดการ Gallery |
| GET | `/api/adminpp/sync-logs` | ดู sync log |
| GET | `/api/adminpp/daily?date=` | รายงานรายวัน (admin) |
| GET | `/api/adminpp/export` | Export CSV |
| POST | `/api/adminpp/reset` | รีเซ็ตข้อมูลวิ่ง (body `{confirm:'RESET'}`, backup ก่อน) |
| GET | `/api/adminpp/seasons/compute` | คำนวณสถิติ season |
| GET | `/api/adminpp/season-status` | สถานะ season ปัจจุบัน + season ถัดไป |
| POST/DELETE | `/api/adminpp/schedule-season` | ตั้ง/แก้/ยกเลิกกำหนดการ season |
| POST | `/api/adminpp/close-season` | ปิด season ทันที |
| POST | `/api/adminpp/start-season` | เริ่ม season (เมื่อ season เดิมปิดแล้ว) |
| POST | `/api/sync/baseline` | ตั้ง baseline (mark is_baseline=1) |
| POST | `/api/sync/close-preseason` | ปิด pre-season |
| GET | `/api/sync/debug` | debug Strava API |

---

## ⚙️ server.js — Cron Jobs

```
ตอนเปิดเซิร์ฟเวอร์
  ├─ migrateSeasonState()          (ครั้งแรกเท่านั้น)
  └─ runSeasonLifecycle('startup')

ทุก 6 ชั่วโมง (00:00, 06:00, 12:00, 18:00)
  ├─ runSeasonLifecycle('cron-6h')  ← upcoming→active / ปิดอัตโนมัติ / เริ่ม season ถัดไป
  └─ runAutoSync('cron-6h')

ทุกคืน 23:59
  ├─ runAutoSync('cron-daily')
  ├─ dailyBackup() → /app/data/backups/daily_YYYY-MM-DD.sqlite
  └─ (วันอาทิตย์เท่านั้น) takeWeeklySnapshot()  ← ข้ามถ้า season ปิดอยู่หรือยังไม่เริ่ม
```

---

## 🔄 Sync Logic (sync.js + server.js)

```
1. ตรวจสอบ token → refresh ถ้าหมดอายุ (< 5 นาที)
2. autoBackup() → สำรอง DB ก่อนทุก sync
3. getClubActivitiesByAthlete() → ดึง activities จาก Strava Club API
4. กรอง: Run (pace 3.5–30 min/km) + Walk (pace 8–17 min/km)
5. สำหรับแต่ละ activity:
   a. ใช้ start_date_local เป็น first_seen (วันที่วิ่งจริง)
   b. Pre-check group run dedup (distance+elapsed เหมือนกัน → ข้าม)
   c. INSERT ... ON CONFLICT DO UPDATE SET first_seen = MIN(first_seen, excluded.first_seen)
6. คำนวณ km, steps, weekly_km, streak, activity_count ต่อคน
7. UPDATE participants
8. rebuildWeeklyData() → rebuild กราฟ weekly
9. บันทึก sync_log
```

### strava_key
```
format: firstname_firstletter(lastname).toLowerCase()
เช่น:   Piean Pps → "piean_p"
ข้อจำกัด: ถ้าชื่อคล้ายกัน (Piean Panya vs Piean Pps) จะ collision
```

### is_baseline
```
0 = กิจกรรม season (นับ km ในระบบ)
1 = กิจกรรม pre-season (ไม่นับ km)

ตั้งค่าโดย (อัตโนมัติ):
- sync / cron              → ตามช่วงวัน season (ดู "ตั้งค่า Season" ด้านล่าง)
- closeSeason()            → freeze ทุกกิจกรรมของ season ที่ปิด
- startSeason()            → ปรับให้ตรงช่วงวันของ season ใหม่
แบบเดิม (กดเอง):
- POST /api/sync/baseline    → mark ทุก activity ปัจจุบันเป็น baseline
- POST /api/sync/close-preseason → mark activity ก่อน season_start เป็น baseline
```

---

## 🔐 Authentication

```
Admin JWT:
- signToken() → payload + HMAC-SHA256 (ADMIN_JWT_SECRET)
- expire: 24 ชั่วโมง
- requireAdmin middleware ตรวจสอบทุก admin route

Strava OAuth:
- OAuth 2.0 Authorization Code flow
- token เก็บใน strava_tokens table
- auto-refresh ถ้า expires_at < 5 นาที
```

---

## 💾 Backup Strategy

| ประเภท | เวลา | ที่เก็บ | เก็บกี่ไฟล์ |
|--------|------|---------|-----------|
| Pre-sync auto | ทุกครั้งที่กด Sync | `/app/data/backups/auto_sync_*.sqlite` | 60 ไฟล์ |
| Daily auto | ทุกคืน 23:59 | `/app/data/backups/daily_*.sqlite` | 90 ไฟล์ |
| Cron host | ทุกวันตี 2 | `/home/450k-runner/db-backups/` | 90 ไฟล์ |

### Restore
```bash
docker stop backend-450k
cp /app/data/backups/daily_2026-05-01.sqlite /app/data/450k.sqlite
docker start backend-450k
```

---

## 🚨 สิ่งที่ต้องระวัง

| เรื่อง | รายละเอียด |
|-------|-----------|
| **ห้าม Reset ระหว่าง season** | จะลบ activities ทุก season ดึงคืนไม่ได้ถ้า Strava ลบแล้ว (ต้องพิมพ์ RESET + มี backup ก่อน) |
| **Docker build vs restart** | แก้ code ต้อง `docker compose build` ไม่ใช่แค่ `restart` |
| **season_start priority** | DB (Admin UI) > .env > hardcoded '2026-06-01' |
| **strava_key collision** | ชื่อ firstname+initial ซ้ำกัน → activities รวมกัน |
| **Group run duplicate** | ป้องกันด้วย pre-check distance+elapsed ก่อน insert |
| **Strava Club API window** | คืนแค่ 4–6 สัปดาห์ล่าสุด → activities เก่ากว่านั้นต้องพึ่ง DB |

---

## 📅 ตั้งค่า Season (อัตโนมัติ — ไม่ต้องกด Baseline แล้ว)

Admin → 📅 Seasons → กล่อง **"ตั้งค่า Season"**: กรอกชื่อ, วันเริ่ม, ระยะเวลา (ค่าเริ่มต้น 3 เดือน → วันสิ้นสุดคำนวณให้),
ติ๊ก "ปิดอัตโนมัติ" + จำนวนวันรอหลังจบ (grace, ค่าเริ่มต้น 2 วัน) แล้วกด **บันทึกกำหนดการ** ครั้งเดียว

```
upcoming ──(00:00 วันเริ่ม)──▶ active ──(วันสิ้นสุด + grace)──▶ ปิด (done) ──▶ season ถัดไปที่ตั้งไว้
```

| สถานะตอนกดบันทึก | ระบบทำอะไร |
|---|---|
| Season ปิดอยู่ | สร้าง season ใหม่ทันที (status `upcoming` ถ้ายังไม่ถึงวันเริ่ม) |
| Season ปัจจุบันยังไม่เริ่ม | แก้ชื่อ/วันที่ของ season นั้น |
| Season ปัจจุบันกำลังแข่ง/ครบกำหนดแล้ว | เก็บเป็น `next_season` → เริ่มให้เองทันทีหลังปิด season ปัจจุบัน |

ตัวอย่าง S1 → S2: ตั้ง "Season 2 · 2027-04-01 · 3 เดือน" → ระบบปิด S1 ตามกำหนด (หรือกด "ปิด Season ตอนนี้"),
สร้าง S2 เป็น `upcoming` (หน้าเว็บนับถอยหลัง) → 1 เม.ย. 2027 00:00 เปลี่ยนเป็น `active` → นับ km เฉพาะ 1 เม.ย.–30 มิ.ย. 2027
→ ปิดและสรุปผลเอง 3 ก.ค. 2027

**การปิด season** (`closeSeason` — ทั้งปิดเองและปิดอัตโนมัติ):
backup (`auto_close-season_*.sqlite`, ไม่ถูกลบตามรอบ — backup ไม่ผ่านจะไม่ปิด) → snapshot สัปดาห์สุดท้าย →
สรุปผลรายคนจาก **กิจกรรมในช่วงวันของ season เท่านั้น** ลง `seasons.results_json` → freeze กิจกรรม (`is_baseline=1`) →
reset km ทุกคน → `season_closed=1` → เริ่ม `next_season` ถ้ามี

**กฎ baseline ตอน sync** (`lib/season.js → baselineFlagFor`): กิจกรรมที่วิ่ง **ก่อน** `season_start`, **หลัง** `season_end`
หรือ sync เข้ามาตอน `season_closed=1` จะเป็น `is_baseline=1` (ไม่นับ km) เสมอ
ตอนเริ่ม season ใหม่ กิจกรรมที่อยู่ในช่วงวันแต่ sync เข้ามาระหว่างที่ปิดอยู่จะถูกปลดให้นับ

**project_settings ที่ระบบจัดการเอง** (PUT `/settings` จะไม่ทับ): `season_closed`, `current_season_id`,
`next_season`, `last_frozen_through` — ส่วน `season_auto_close`, `season_close_grace_days` ตั้งผ่านกล่องตั้งค่า Season

`weekly_snapshots.season_id` แยก snapshot ราย season (week_no ซ้ำข้าม season ได้ ไม่ทับกัน);
`GET /api/weekly-snapshots` คืนของ season ปัจจุบัน หรือระบุ `?season_id=` เพื่อดูย้อนหลัง

**Deploy ครั้งแรกหลังอัปเดตนี้**: migration จะเดา `season_closed` จากตาราง seasons
(ไม่มี season `active`/`pre-season` + มี season `done` = ปิดแล้ว) และผูก weekly snapshot เดิมกับ season ปัจจุบัน
— Season ที่กำลังแข่งอยู่ก่อนอัปเดตจะ **ไม่ปิดอัตโนมัติ** จนกว่าจะบันทึกกำหนดการพร้อมติ๊กปิดอัตโนมัติ (หรือกดปิดเอง)

เครื่องมือแบบเดิม (ตั้ง Baseline / ปิด Pre-Season) ยังอยู่ใต้ปุ่ม "⚙️ เครื่องมือแบบเดิม" ในหน้าภาพรวม;
`POST /api/sync/reset-baseline` ถูกปิดเมื่อมี season ที่จบแล้ว (จะดึงกิจกรรม season เก่ากลับมานับ)

---

## ✨ Animation (หน้าเว็บสาธารณะ)

เลือกจาก [Motion Reference](https://motion-reference.takayustudio.jp/) — ค่า duration/easing ตาม reference
ไม่มี library เพิ่ม: `src/styles/motion.css` (keyframes + easing tokens) + `src/motion/Motion.tsx` (React helpers)

| Motion (reference) | ใช้ที่ |
|---|---|
| ソフトライズ soft-rise | หัวข้อทุก section, ชื่อโครงการใน hero |
| フェード＋スライド fade-slide | ข้อความรองใน hero |
| スクロールリビール scroll-reveal | การ์ดความคืบหน้า hero, กล่องระยะเวลาโครงการ |
| リスト順次表示 list-stagger | แถว leaderboard, ผลรายสัปดาห์ |
| グリッドウェーブ grid-wave | การ์ด About / Milestones / Seasons |
| カウントアップ count-up (easeOutExpo) | km รวม, %, ค่าใน leaderboard, km ของ milestone, วันที่เหลือก่อนเริ่ม season |
| 進捗バー progress-fill | แถบความคืบหน้าทั้งหมด |
| FLIP並べ替え flip-reorder | leaderboard ตอนสลับแท็บ/อันดับเปลี่ยน |
| ポップスケール pop-scale | โลโก้, เหรียญ top 3, badge, ป้าย "ปลดล็อก" |
| ハイライトスイープ / ライトスイープ | milestone ที่ปลดล็อก (ครั้งเดียว), แถบ hero + season ที่กำลังแข่ง (วนซ้ำ) |
| グローパルス glow-pulse | โลโก้, avatar อันดับ 1, ป้าย "กำลังดำเนิน" |
| スナップイン snap-in | ตัวเลขนับถอยหลังใน hero |
| スケルトンシマー skeleton-shimmer | leaderboard ระหว่างโหลดครั้งแรก (แทนการโชว์ mock data) |
| スクロール進捗 scroll-progress | แถบบางด้านบนสุด |
| ホバーリフト hover-lift | การ์ดตอน hover |

ระดับ animation: Admin → ตั้งค่าโครงการ → "Animation หน้าเว็บ" (`motion_level`: `full` / `subtle` / `off`)
ผู้ใช้ที่ตั้ง *ลดการเคลื่อนไหว* (prefers-reduced-motion) ในเครื่องจะเห็นแบบ `off` เสมอ
ถ้า IntersectionObserver ไม่ตอบใน 1.5 วินาที เนื้อหาจะแสดงทันที (กันเนื้อหาค้างที่ opacity 0)

---

## 🛠️ .env ที่ต้องตั้ง

```env
PORT=4000
CORS_ORIGIN=https://your-frontend.vercel.app

# Strava
STRAVA_CLIENT_ID=xxxxx
STRAVA_CLIENT_SECRET=xxxxx
STRAVA_CLUB_ID=xxxxx
STRAVA_REDIRECT_URI=https://your-backend.com/api/auth/callback

# Admin
ADMIN_USER=admin
ADMIN_PASSWORD=yourpassword
ADMIN_JWT_SECRET=random-secret-string

# Season
SEASON_START=2026-06-01

# DB (optional override)
DB_PATH=/app/data/450k.sqlite
BACKUP_DIR=/app/data/backups
```
