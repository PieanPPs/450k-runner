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

### 2. VPS — Pull + Build + Deploy (คำสั่งเดียวจบ)

```bash
cd /home/450k-runner && git pull && docker run --rm -v $(pwd):/app -w /app node:22-slim sh -c "npm install && npm run build" && docker compose up -d --build
```

### สรุปสั้น ๆ (ทุกครั้งที่ deploy)

| ขั้นตอน | คำสั่ง |
|---------|--------|
| Local — commit & push | `git add -A` → `git commit -m "..."` → `git push origin main` |
| VPS — pull + build + restart | `cd /home/450k-runner && git pull && docker run --rm -v $(pwd):/app -w /app node:22-slim sh -c "npm install && npm run build" && docker compose up -d --build` |
