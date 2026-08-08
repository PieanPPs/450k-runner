# ADR-0001: Strava OAuth Login สำหรับครู (Participant-facing login)

**Status:** Proposed
**Date:** 2026-06-24
**Deciders:** PIEAN (ผู้ดูแลระบบ 450k-runner)

## Context

ปัจจุบันระบบดึงข้อมูลวิ่งทั้งหมดผ่าน **Strava Club API** โดยใช้ token ของบุคคลเดียว
(`strava_tokens` แถวที่ดึงด้วย `LIMIT 1` ใน `sync.js` / `server.js`) ครูแต่ละคน**ไม่ต้อง login**
กับแอปเลย แค่ปรากฏอยู่ในกิจกรรมของ Strava Club ก็ถูกดึงข้อมูลมารวมแล้ว จับคู่กับ participant
ด้วย `strava_key` ที่คำนวณจาก **ชื่อ + อักษรแรกของนามสกุล** (`makeStravaKey()` ใน
`backend/src/strava/client.js`) เพราะ Club API ไม่ส่ง `athlete.id` กลับมา

ตอนนี้ต้องการขยายระบบให้มี **badge ต่อคน + หน้าโปรไฟล์ส่วนตัว** และวางแผนจัดกิจกรรมแบบนี้ทุก
season จึงอยากเริ่มมีระบบ login ที่ครูแต่ละคนเข้ามาดูข้อมูล/badge ของตัวเองได้ โดยอยาก
authen ด้วย Strava OAuth โดยตรง

**สิ่งที่ค้นพบจากโค้ดที่มีอยู่แล้ว (สำคัญต่อการตัดสินใจ):** มี endpoint
`GET /api/auth/strava` + `GET /api/auth/strava/callback` อยู่แล้วใน `backend/src/routes/auth.js`
ซึ่งทำ OAuth flow แบบรายบุคคลไว้สมบูรณ์แล้ว — รับ `participant_id`, ส่งไป Strava ขอ
authorize, แลก `code` เป็น token, แล้วบันทึก:

- `strava_tokens.athlete_id` — **athlete.id ตัวจริงจาก Strava** (ไม่ใช่ key จากชื่อ)
- `participants.strava_key` — คำนวณใหม่จากชื่อจริงที่ Strava ส่งกลับมา (แม่นยำกว่าการเดาจาก Club feed)

Flow นี้ถูกสร้างไว้เพื่อ "เชื่อมต่อ Strava ของครูแต่ละคน" (ดูเหมือนเผื่อไว้สำหรับกรณีต้อง
สลับ token ที่ใช้ sync) แต่ยังไม่เคยถูกใช้เป็น **login** จริง — ปลายทางตอนนี้แค่ render หน้า HTML
"เชื่อมต่อสำเร็จ" แล้วจบ ไม่มีการออก session ใดๆ

## Decision

**นำ OAuth flow ที่มีอยู่แล้ว (`/api/auth/strava`, `/api/auth/strava/callback`) มาต่อยอดเป็นระบบ
login ของครู** แทนการสร้าง OAuth integration ใหม่ทั้งหมด โดยเพิ่ม:

1. ออก session คุกกี้/JWT แบบเดียวกับที่ `adminAuth.js` ใช้อยู่ (`signToken`/`verifyToken` ด้วย
   HMAC, ไม่ต้องเพิ่ม library) แต่แยก secret/payload เป็น `role: 'participant'` คนละชุดกับ admin
   token เพื่อไม่ให้สิทธิ์ปนกัน
2. หลัง callback สำเร็จ → redirect ไปหน้าโปรไฟล์ของครูคนนั้น (ใส่ session cookie) แทนหน้า HTML
   เชื่อมต่อสำเร็จแบบเดิม
3. **แก้บั๊กที่แอบอยู่ก่อนแล้ว**: ต้องแยก "token ที่ใช้ sync ข้อมูล club" ออกจาก "token ที่ใช้
   ยืนยันตัวตน login" อย่างชัดเจน (ดูหัวข้อ Risk ด้านล่าง) ก่อนเปิดให้ครูหลายคน login จริง
4. ใช้ `athlete_id` ที่บันทึกไว้แล้วเป็น identity หลักสำหรับการ login ครั้งต่อๆไป (ไม่ต้อง
   เทียบชื่อซ้ำอีกหลัง login ครั้งแรกผ่านไปแล้ว)

## Options Considered

### Option A: ต่อยอดจาก OAuth flow เดิม + เพิ่ม session (แนะนำ)

| Dimension | Assessment |
|-----------|------------|
| Complexity | ต่ำ — endpoint หลักมีอยู่แล้ว, เพิ่มแค่ session issuance + middleware |
| Cost | ไม่มีค่าใช้จ่ายเพิ่ม (ใช้ Strava App เดิม, ไม่เพิ่ม library) |
| Scalability | รองรับได้ทุก season เพราะ schema ปัจจุบัน (`strava_tokens` PK = participant_id) ออกแบบให้ "หลายคนต่อ token ได้" อยู่แล้ว |
| Team familiarity | สูง — ใช้ pattern เดียวกับ `requireAdmin` ที่มีอยู่แล้วในโปรเจกต์ |

**Pros:**
- ใช้ของที่เขียนไว้แล้วเกือบหมด ลดงานสร้างใหม่
- `athlete_id` จริงถูกบันทึกตั้งแต่ครั้งแรกที่ login — ตัดปัญหาชื่อซ้ำสำหรับครั้งต่อไป
- ไม่ต้องแก้ตาราง sync (`strava_activities`, `participants`) เลย

**Cons:**
- ต้องรีบแก้บั๊ก `LIMIT 1` ใน sync logic ก่อน ไม่งั้นยิ่งมีคน login มาก ยิ่งเสี่ยง sync หยิบ token ผิดคน
- Flow เดิมต้องมี `participant_id` ที่มีอยู่แล้วในระบบก่อนถึงจะ login ได้ (ดู Open Question)

### Option B: สร้าง OAuth flow ใหม่แยกสำหรับ "login" โดยเฉพาะ (ไม่แตะ `strava_tokens`)

| Dimension | Assessment |
|-----------|------------|
| Complexity | กลาง-สูง — ต้องเขียน flow คู่ขนาน, ตาราง `participant_sessions` หรือ field ใหม่แยกจาก token เดิม |
| Cost | ไม่มีค่าใช้จ่ายเพิ่ม |
| Scalability | ดี แต่ซ้ำซ้อนกับของที่มีอยู่ |
| Team familiarity | ต้องเขียน matching logic ใหม่ทั้งหมด (เสี่ยง bug ซ้ำกับที่เคย fix ไปแล้วใน flow เดิม) |

**Pros:** แยก concern ชัดเจนระหว่าง "sync credential" กับ "login identity" ตั้งแต่ต้น ไม่ต้องห่วงเรื่อง LIMIT 1 ชนกัน
**Cons:** งานซ้ำซ้อน, เสี่ยง maintain สอง flow คู่ขนานที่ทำเรื่องคล้ายกันมาก

### Option C: ระบบ login แบบไม่ใช้ Strava (PIN/รหัสผ่านที่ admin ตั้งให้)

| Dimension | Assessment |
|-----------|------------|
| Complexity | ต่ำมาก |
| Cost | ไม่มี |
| Scalability | ดี แต่ครูต้องจำ PIN เพิ่มอีกชุด |
| Team familiarity | สูง |

**Pros:** ไม่ผูกกับ Strava เลย เผื่ออนาคตเปิดรับคนที่ไม่ใช้ Strava
**Cons:** ไม่ตอบโจทย์ "authen ด้วย Strava" ที่ตั้งใจไว้, เพิ่มภาระจำรหัสให้ครู

## Trade-off Analysis

Option A ชนะชัดเจนในระยะสั้นเพราะ "ของเกือบทุกชิ้นที่ต้องใช้มีอยู่แล้วในโค้ด" — ความเสี่ยงหลักไม่ได้
อยู่ที่การสร้างของใหม่ แต่อยู่ที่ **ผลข้างเคียงต่อระบบ sync เดิม** ที่ไม่เคยถูกออกแบบมาให้รองรับ
"token หลายแถวที่ active พร้อมกัน" — ต้องแก้ก่อนเปิดใช้งานจริง ไม่ใช่แก้ทีหลัง

Option B สะอาดกว่าในทางทฤษฎีแต่จ่ายด้วยงานซ้ำซ้อนและความเสี่ยง bug ใหม่ ไม่คุ้มเมื่อ Option A
แก้จุดเสี่ยงเดียวกันได้ด้วยงานน้อยกว่า

## จุดเสี่ยงที่ต้องตัดสินใจ (Risks needing a decision)

**1. ชื่อซ้ำตอน login ครั้งแรก (เดิมที่คุยไว้)**
`strava_key` คำนวณจากชื่อ+อักษรแรกนามสกุล ถ้ามีครู 2 คนชื่อพ้องกัน (เช่น "สมชาย ใจดี" กับ
"สมชาย ใจเด็ด" → key เดียวกันคือ `สมชาย_ใ`) การ login ครั้งแรกอาจจับคู่กับ participant ผิดคน
**แต่หลัง login สำเร็จครั้งแรก** ระบบมี `athlete_id` จริงเก็บไว้แล้ว ครั้งต่อไปควร match ด้วย
`athlete_id` ตรงๆ ไม่ใช้ชื่ออีก — ความเสี่ยงนี้จึงเกิดได้แค่ "ครั้งแรกที่ละคน login เท่านั้น"

**2. (พบใหม่ระหว่างอ่านโค้ด) sync logic หยิบ token ผิดคนเมื่อมีคน login หลายคน**
`sync.js`, `server.js` ใช้ `SELECT ... FROM strava_tokens LIMIT 1` แบบไม่ระบุ `WHERE`/`ORDER BY` —
ตอนนี้ใช้ได้เพราะมี token แค่แถวเดียว (admin คนเดียวเชื่อมไว้) แต่ทันทีที่เปิดให้ครูหลาย
คน "login ด้วย Strava" ผ่าน flow เดียวกันนี้ จะมี token หลายแถวใน `strava_tokens` และ
`LIMIT 1` จะกลายเป็นการสุ่มว่าจะหยิบ token ของใครมาใช้ดึงข้อมูล club ทั้งหมด — **ต้องแก้ก่อน
เปิดใช้งานจริง** ไม่ใช่ปล่อยไว้

**3. ครูที่ยังไม่มี participant record ในระบบ (ยังไม่เคยวิ่ง/sync เข้ามา)**
Flow เดิม (`GET /api/auth/strava?participant_id=...`) ต้องมี `participant_id` ที่มีอยู่แล้วเป็น
input — แปลว่าตอนนี้ admin ต้อง "สร้างครูในระบบไว้ก่อน" ครูถึงจะ login ได้ ถ้าอยากให้ครูใหม่
self-register ได้เองตั้งแต่หน้า login ต้องเพิ่ม flow "สร้าง participant ใหม่ถ้ายังไม่เจอ" เข้าไป
(เป็นทางเลือก ไม่ทำก็ได้ถ้า admin รับว่าจะเพิ่มชื่อครูก่อนเปิด season ทุกครั้ง)

**4. เก็บ access_token ส่วนตัวของครูทุกคนไว้ใน DB**
เดิมมี token แค่ของผู้ดูแล 1 ชุด ความเสี่ยงต่ำ พอเปิดให้ทุกคน login จะมี personal access_token
ของทุกคนถูกเก็บไว้ในตารางเดียวกัน ถ้า DB หลุด ความเสียหายจะกว้างขึ้น (ควรพิจารณาว่าจริงๆแล้ว
หลังจาก login เสร็จ ต้องการเก็บ access_token ของครูแต่ละคนไว้ทำอะไรต่อหรือไม่ ถ้าไม่ใช้ทำอะไร
อาจไม่ต้องเก็บ refresh_token ของรายบุคคลเลย เก็บแค่ athlete_id ไว้ยืนยันตัวตนพอ)

## Consequences

- ง่ายขึ้น: ไม่ต้องสร้าง OAuth integration ใหม่, ใช้ Strava App เดิม, ใช้ pattern JWT เดิม
- ต้องทำก่อนเปิดใช้จริง: แก้ sync logic ให้ระบุ "token ไหนคือตัวที่ใช้ sync club" อย่างชัดเจน
  แยกจาก token ของครูที่ login ทั่วไป (เช่น เก็บ `participant_id` ที่เป็น sync source ไว้ใน
  `project_settings` หรือ env var แทนการเดาจาก `LIMIT 1`)
- ต้องตัดสินใจ: เปิดให้ครูใหม่ self-register ตอน login เลยไหม หรือ admin ต้องเพิ่มชื่อไว้ก่อน
- ต้องพิจารณา: จะเก็บ personal access_token/refresh_token ของครูทุกคนไว้จริงหรือไม่ ถ้าจุดประสงค์
  มีแค่ "ยืนยันตัวตน" อาจตัดการเก็บ token ส่วนตัวออก เก็บแค่ `athlete_id` ก็พอ

## Action Items

1. [ ] แก้ `sync.js` / `server.js` — เลือก token สำหรับ sync club จาก `participant_id` ที่กำหนดไว้
      ชัดเจน (env var หรือ setting) ไม่ใช่ `LIMIT 1`
2. [ ] เพิ่ม session/JWT issuance ใน `auth.js` callback (`role: 'participant'`, แยก secret จาก admin)
3. [ ] เพิ่ม middleware `requireParticipant` คู่กับ `requireAdmin` ที่มีอยู่แล้ว
4. [ ] ตัดสินใจเรื่อง self-register ครูใหม่ตอน login (ข้อ 3 ใน Risks)
5. [ ] ตัดสินใจเรื่องการเก็บ personal access_token/refresh_token ของครูแต่ละคน (ข้อ 4 ใน Risks)
6. [ ] ออกแบบหน้าโปรไฟล์ปลายทางหลัง login (badge, บิงโกของตัวเอง) — ขึ้นกับ ADR/feature ถัดไป
