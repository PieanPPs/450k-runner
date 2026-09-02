# 450K Teacher's Spirit (React + Vite)

โปรเจกต์ Dashboard สำหรับกิจกรรมวิ่งสะสมระยะทางของครู

## Stack
- React 18
- TypeScript
- Vite 5

## โครงสร้างหลัก
- `src/components` ส่วน UI (Nav, Hero, Leaderboard, Milestones, Journey, WeeklyGraph, Seasons, Gallery, Footer)
- `src/data/mock.ts` ข้อมูล mock ทั้งหมด
- `src/themes` ธีม Dark/Light + Theme context
- `src/types` type definitions
- `src/styles/globals.css` global styles

## วิธีรัน
```bash
npm install
npm run dev
```
เปิด `http://localhost:5173`

## วิธี build
```bash
npm run build
npm run preview
```

## หมายเหตุ
- ตอนนี้ใช้ mock data พร้อมต่อ API จริงภายหลัง
- Theme toggle อยู่ที่ปุ่มมุมขวาบนของ Navbar

---

## 🚀 Deploy — ขั้นตอนทุกครั้งที่มีการแก้ไขโค้ด

### 1. PowerShell (เครื่อง local) — Push โค้ดขึ้น GitHub

```powershell
cd C:\Users\acer\Downloads\Running-handoff\450k-runner
git add -A
git commit -m "describe your change here"
git push origin main
```

> หาก push ถูก reject (diverged) ให้ pull ก่อน:
> ```powershell
> git pull --rebase origin main
> git push origin main
> ```

### 2. VPS — Pull + Build + Restart

SSH เข้า VPS แล้วรันทีละคำสั่ง:

```bash
cd ~/450k-runner
git pull origin main
```

#### Build frontend (VPS ไม่มี npm ให้ใช้ Docker):
```bash
docker run --rm -v $(pwd):/app -w /app node:22-slim sh -c "npm install && npm run build"
```

#### Restart backend (ถ้ามีการแก้ backend):
```bash
pm2 restart 450k-backend
# หรือ
pm2 restart all
```

#### ตรวจสอบ log:
```bash
pm2 logs 450k-backend --lines 30
```

### สรุปสั้น ๆ (ทุกครั้งที่ deploy)

| ขั้นตอน | คำสั่ง |
|---------|--------|
| Local — commit & push | `git add -A` → `git commit -m "..."` → `git push origin main` |
| VPS — pull | `git pull origin main` |
| VPS — build frontend | `docker run --rm -v $(pwd):/app -w /app node:22-slim sh -c "npm install && npm run build"` |
| VPS — restart backend | `pm2 restart 450k-backend` |
