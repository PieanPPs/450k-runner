# ☁️ ย้ายระบบไป Cloudflare

> หน้าเว็บ (Vercel) + backend/DB (VPS) → **Cloudflare Worker ตัวเดียว**
> โค้ด backend ชุดเดียวรันได้ทั้งสองที่ — VPS ใช้ `backend/src/server.js`, Cloudflare ใช้ `backend/src/worker.js`
> ระหว่างย้าย VPS ยังทำงานตามปกติ ปิดทีหลังได้

## ภาพรวม

| เดิม | Cloudflare | หมายเหตุ |
|---|---|---|
| Vercel (`run.ppiean.com`) | Workers Static Assets (`dist/`) | build ด้วย `npm run build:cf` |
| Express บน VPS (`api.ppiean.com`) | Worker (`backend/src/worker.js`) | Express 5 ผ่าน `nodejs_compat` |
| SQLite ไฟล์ | **D1** (`450k-runner`) | SQL เดิม — ย้ายด้วย dump/import |
| backup ไฟล์ทุก sync / ทุกคืน | **D1 Time Travel** | ย้อนกลับได้ระดับนาที (ฟรี 7 วัน / Paid 30 วัน) |
| node-cron | **Cron Triggers** | `0 5,11,17,23 * * *` และ `59 16 * * *` (UTC = 00/06/12/18 น. และ 23:59 เวลาไทย) |
| รูป gallery บนดิสก์ | **R2** (`450k-runner-gallery`) | |
| `backend/.env` | **Workers secrets** | |

ทั้ง `run.ppiean.com` และ `api.ppiean.com` ชี้ไป Worker ตัวเดียวกัน — Strava OAuth (`api.ppiean.com/api/auth/strava/callback`) ไม่ต้องแก้

### แพ็กเกจฟรี
- D1 ฟรีจำกัด **50 query ต่อ request** → sync ถูกเขียนใหม่ให้ใช้ ~20 query ต่อรอบไม่ว่ามีกี่กิจกรรม
- Worker ฟรีจำกัด CPU 10ms ต่อ request (ไม่นับเวลารอ DB/Strava) — งานปกติพอ
- ถ้าเห็น error `1102` / `exceeded CPU` / `Too many API requests` ใน log (`npx wrangler tail`) → อัปเกรด Workers Paid ($5/เดือน) ที่ Dashboard → Workers & Pages → Plans ไม่ต้องแก้โค้ด
- อัปโหลดรูป gallery ขนาดใหญ่มาก (หลาย MB) อาจชน CPU 10ms — ย่อรูปก่อนอัปโหลด หรืออัปเกรด

---

## ขั้นตอน (ทำครั้งเดียว — ในเครื่องที่มีโค้ดนี้)

ทำช่วงพักระหว่าง season (ก่อน 1 มี.ค. 2570) — ข้อมูลไม่เปลี่ยนระหว่างย้าย

### 1. Login Cloudflare
```bash
npx wrangler login
```

### 2. สร้าง D1 และ R2
```bash
npx wrangler d1 create 450k-runner
```
คัดลอก `database_id` ที่ได้ ไปแทน `00000000-0000-0000-0000-000000000000` ใน `wrangler.jsonc`

```bash
npx wrangler r2 bucket create 450k-runner-gallery
```
> ครั้งแรกที่ใช้ R2 Dashboard อาจให้กดเปิดใช้ R2 / ผูกวิธีชำระเงินก่อน แม้ใช้ไม่เกินโควตาฟรี (10 GB)

### 3. คัดลอกข้อมูลจาก VPS
บน VPS — หยุด backend ให้ข้อมูลใน WAL เขียนลงไฟล์หลักครบ แล้วคัดลอก:
```bash
docker compose stop backend-450k
```
```bash
cp /home/450k-runner/backend/data/450k.sqlite /tmp/450k-export.sqlite
```
```bash
docker compose start backend-450k
```
แล้วดึงไฟล์ `/tmp/450k-export.sqlite` และโฟลเดอร์ `/home/450k-runner/backend/data/gallery` มาไว้ในเครื่องนี้ (เช่น ด้วย `scp`) — **อย่าวางทับ `backend/data/` ของเครื่องนี้** ให้วางในโฟลเดอร์แยก เช่น `C:\450k-migrate\`

### 4. นำข้อมูลเข้า D1
```bash
node backend/scripts/export-for-d1.mjs C:/450k-migrate/450k-export.sqlite C:/450k-migrate/d1-import.sql
```
```bash
npx wrangler d1 execute 450k-runner --remote --file C:/450k-migrate/d1-import.sql
```
> ไฟล์ import มี `DROP TABLE` — รันซ้ำได้ (แทนที่ข้อมูลใน D1 ทั้งหมดด้วยข้อมูลจากไฟล์) **ห้ามรันหลังจากเปิดใช้จริงแล้ว** เพราะจะทับข้อมูลใหม่บน D1

ตรวจจำนวนแถว:
```bash
npx wrangler d1 execute 450k-runner --remote --command "SELECT COUNT(*) AS n FROM strava_activities"
```

### 5. อัปโหลดรูป gallery
```bash
node backend/scripts/upload-gallery-to-r2.mjs C:/450k-migrate/gallery
```

### 6. ตั้งค่าลับ (secrets)
คัดเฉพาะค่าที่ต้องใช้จาก `.env` ของ VPS (ไม่แสดงค่าบนจอ):
```bash
node backend/scripts/env-to-cf-secrets.mjs C:/450k-migrate/.env cf-secrets.env
```
```bash
npx wrangler secret bulk cf-secrets.env
```
แล้ว**ลบไฟล์ `cf-secrets.env`** (ถูก .gitignore ไว้แล้ว) — ค่าที่ต้องมี: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_CLUB_ID`, `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`

> ถ้าสคริปต์บอกว่าขาดค่าไหน ตั้งทีละค่าด้วย `npx wrangler secret put <ชื่อ>`
> ถ้า deploy ครั้งแรกยังไม่เคยทำ `secret bulk` อาจต้อง deploy ก่อน 1 ครั้ง (ขั้นที่ 7) แล้วค่อยกลับมาทำขั้นนี้

### 7. Deploy และทดสอบบนชื่อชั่วคราว
```bash
npm run cf:deploy
```
จะได้ URL แบบ `https://450k-runner.<ชื่อบัญชี>.workers.dev` — เปิดตรวจ:
- หน้าแรก, leaderboard, Seasons แสดงข้อมูลตรงกับเว็บจริง
- `/adminpp` login ได้, แท็บ Seasons แสดงสถานะ season ถูก
- รูป gallery ขึ้นครบ
- กด **Sync Strava** ในหน้า admin ได้ (ข้อมูลเข้า D1 ไม่กระทบ VPS)

ดู log แบบสด:
```bash
npx wrangler tail
```

### 8. ย้ายโดเมน (cutover)
1. ทำขั้น 3–4 ซ้ำอีกรอบ เพื่อให้ D1 มีข้อมูลล่าสุดจาก VPS (ขั้น 5 ทำซ้ำถ้ามีรูปใหม่)
2. Cloudflare Dashboard → DNS ของ `ppiean.com` → **ลบ** record `api` (ชี้ VPS) และ `run` (ชี้ Vercel)
3. เพิ่มใน `wrangler.jsonc`:
   ```jsonc
   "routes": [
     { "pattern": "run.ppiean.com", "custom_domain": true },
     { "pattern": "api.ppiean.com", "custom_domain": true }
   ],
   ```
   แล้ว `npm run cf:deploy` — Cloudflare สร้าง DNS + HTTPS ให้เอง (รอไม่กี่นาที)
4. ตรวจ `https://run.ppiean.com` และ `https://api.ppiean.com/api/health`
5. ปิด cron ของ VPS เพื่อไม่ให้ sync ซ้ำซ้อน: `docker compose stop backend-450k`
6. ที่ Vercel: ปิด/ลบ project (หรือถอด custom domain) เพื่อไม่ให้แย่งโดเมน

### 9. หลังย้าย
- เก็บ VPS ไว้ 1–2 สัปดาห์เผื่อย้อนกลับ แล้วค่อยเลิกเช่า
- **ย้อนกลับ (rollback):** ลบ custom domain ของ Worker (Dashboard → Workers → 450k-runner → Settings → Domains) แล้วสร้าง DNS record `api` → IP VPS และ `run` → Vercel ตามเดิม แล้ว `docker compose start backend-450k`
  (ข้อมูลที่เกิดบน Cloudflare หลังย้ายจะไม่อยู่ใน VPS)

---

## งานประจำ

| งาน | คำสั่ง |
|---|---|
| Deploy โค้ดใหม่ | `npm run cf:deploy` |
| ดู log สด | `npx wrangler tail` |
| สำรอง DB เป็นไฟล์ | `npx wrangler d1 export 450k-runner --remote --output backup.sql` |
| กู้คืน DB ไปยังเวลาก่อนหน้า | `npx wrangler d1 time-travel restore 450k-runner --timestamp=<unix หรือ ISO>` |
| ดูจุดกู้คืน | `npx wrangler d1 time-travel info 450k-runner` |
| ทดสอบในเครื่อง | `npm run cf:dev` (ใช้ D1/R2 จำลองใน `.wrangler/` และค่าลับจาก `.dev.vars`) |

เวลา "backup" ที่หน้า admin แสดงตอนปิด season (`D1 Time Travel @ …`) คือเวลาที่ใช้กู้คืนได้ด้วยคำสั่ง `time-travel restore`

### ทดสอบในเครื่อง (`npm run cf:dev`)
1. สร้างไฟล์ `.dev.vars` (ไม่ commit) ใส่ค่าทดสอบ เช่น `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`
2. นำข้อมูลเข้า D1 จำลอง: `npx wrangler d1 execute 450k-runner --local --file <ไฟล์จาก export-for-d1.mjs>`
3. จำลอง cron: เปิด `http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+5,11,17,23+*+*+*`

## โครงสร้างโค้ดที่เกี่ยวข้อง
```
wrangler.jsonc                       ← config Worker (assets, D1, R2, cron, vars)
backend/src/worker.js                ← entry ของ Cloudflare (fetch + scheduled)
backend/src/server.js                ← entry ของ VPS (ยังใช้ได้)
backend/src/app.js                   ← Express app ที่ใช้ร่วมกัน
backend/src/lib/db.js                ← ฐานข้อมูลแบบ async (better-sqlite3 หรือ D1)
backend/src/lib/platform.js          ← backup + ที่เก็บรูป (ดิสก์ หรือ R2)
backend/src/lib/stravaSync.js        ← sync Strava แบบรวบ query (ใช้ทั้งปุ่ม Sync และ cron)
backend/src/lib/participantStats.js  ← คำนวณ km/streak/weekly ของทุกคนใน 4 query
backend/src/lib/jobs.js              ← งานตามเวลา (6 ชม. / 23:59)
backend/scripts/export-for-d1.mjs    ← SQLite → SQL สำหรับ D1
backend/scripts/upload-gallery-to-r2.mjs
backend/scripts/env-to-cf-secrets.mjs
```
