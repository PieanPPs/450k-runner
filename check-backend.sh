#!/bin/bash
# ========================================
# check-backend.sh — ตรวจสอบสถานะ Backend
# วิธีใช้: bash check-backend.sh
# ========================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

API_URL="https://api.ppiean.com"
DB_PATH="$(dirname "$0")/backend/data/450k.sqlite"

echo ""
echo -e "${BOLD}🏃 ตรวจสอบระบบ 450K Runner${NC}"
echo "=================================="
echo ""

# ── 1. Docker Container ──────────────────────────
echo -e "${BLUE}▶ 1. Docker Container${NC}"
if docker compose ps backend-450k 2>/dev/null | grep -q "running"; then
  echo -e "   ${GREEN}✅ backend-450k กำลังทำงาน${NC}"
else
  echo -e "   ${RED}❌ backend-450k ไม่ทำงาน${NC}"
  echo -e "   ${YELLOW}   แก้: docker compose up -d backend-450k${NC}"
fi
echo ""

# ── 2. API Health ─────────────────────────────────
echo -e "${BLUE}▶ 2. API /api/summary${NC}"
RESPONSE=$(curl -s --max-time 5 "${API_URL}/api/summary" 2>&1)
if echo "$RESPONSE" | grep -q '"totalKm"'; then
  TOTAL_KM=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"totalKm\"]:.1f}')" 2>/dev/null || echo "?")
  PARTICIPANTS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['participantCount'])" 2>/dev/null || echo "?")
  echo -e "   ${GREEN}✅ API ตอบสนองปกติ${NC}"
  echo -e "   📊 km รวม: ${BOLD}${TOTAL_KM} km${NC} | ผู้เข้าร่วม: ${BOLD}${PARTICIPANTS} คน${NC}"
else
  echo -e "   ${RED}❌ API ไม่ตอบสนอง${NC}"
  echo -e "   Response: ${RESPONSE:0:100}"
  echo -e "   ${YELLOW}   แก้: docker compose logs backend-450k${NC}"
fi
echo ""

# ── 3. API Participants ──────────────────────────
echo -e "${BLUE}▶ 3. API /api/participants${NC}"
PARTS=$(curl -s --max-time 5 "${API_URL}/api/participants" 2>&1)
if echo "$PARTS" | grep -q '\['; then
  COUNT=$(echo "$PARTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  echo -e "   ${GREEN}✅ ดึงข้อมูลได้ ${COUNT} คน${NC}"
else
  echo -e "   ${RED}❌ ไม่สามารถดึงข้อมูลผู้เข้าร่วมได้${NC}"
fi
echo ""

# ── 4. Database File ─────────────────────────────
echo -e "${BLUE}▶ 4. SQLite Database${NC}"
if [ -f "$DB_PATH" ]; then
  DB_SIZE=$(du -sh "$DB_PATH" | cut -f1)
  DB_MODIFIED=$(stat -c "%y" "$DB_PATH" 2>/dev/null | cut -d'.' -f1)
  echo -e "   ${GREEN}✅ ไฟล์ DB มีอยู่ (${DB_SIZE})${NC}"
  echo -e "   📅 แก้ไขล่าสุด: ${DB_MODIFIED}"
else
  echo -e "   ${RED}❌ ไม่พบไฟล์ DB ที่ ${DB_PATH}${NC}"
fi
echo ""

# ── 5. Auto-sync (Cron) ──────────────────────────
echo -e "${BLUE}▶ 5. Auto-sync (Cron)${NC}"
if crontab -l 2>/dev/null | grep -q "450k\|sync\|4000"; then
  echo -e "   ${GREEN}✅ Cron job มีอยู่${NC}"
  crontab -l 2>/dev/null | grep -E "450k|sync|4000" | sed 's/^/   /'
else
  echo -e "   ${YELLOW}⚠️  ไม่พบ Cron job — sync อัตโนมัติอาจไม่ทำงาน${NC}"
  echo -e "   ${YELLOW}   ดูวิธีตั้ง cron ใน backup.sh${NC}"
fi
echo ""

echo "=================================="
echo -e "${BOLD}✅ ตรวจสอบเสร็จสิ้น$(date '+  %Y-%m-%d %H:%M:%S')${NC}"
echo ""
