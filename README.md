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
