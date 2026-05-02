#!/bin/bash
# ========================================
# backup.sh — Backup ฐานข้อมูล 450K Runner
# วิธีใช้ (manual): bash backup.sh
# วิธีตั้ง auto (cron): ดูด้านล่าง
# ========================================

# ── ตั้งค่า Path ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_SOURCE="${SCRIPT_DIR}/backend/data/450k.sqlite"
BACKUP_DIR="${SCRIPT_DIR}/backend/data/backups"
MAX_BACKUPS=30          # เก็บ backup สูงสุด 30 ไฟล์ (ประมาณ 1 เดือน)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}💾 Backup 450K Database${NC} — $(date '+%Y-%m-%d %H:%M:%S')"

# ── สร้าง backup directory ──────────────────────
mkdir -p "$BACKUP_DIR"

# ── ตรวจสอบว่า DB มีอยู่ ────────────────────────
if [ ! -f "$DB_SOURCE" ]; then
  echo -e "${RED}❌ ไม่พบไฟล์ DB: ${DB_SOURCE}${NC}"
  exit 1
fi

# ── สร้างชื่อไฟล์ backup ────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/450k_${TIMESTAMP}.sqlite"

# ── Copy ไฟล์ (SQLite-safe: ใช้ cp ไม่ใช่ mv) ──
cp "$DB_SOURCE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup สำเร็จ: ${BACKUP_FILE} (${SIZE})${NC}"
else
  echo -e "${RED}❌ Backup ล้มเหลว!${NC}"
  exit 1
fi

# ── ลบ backup เก่าเกิน MAX_BACKUPS ─────────────
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  echo -e "${YELLOW}🗑️  ลบ backup เก่า ${DELETE_COUNT} ไฟล์ (เก็บไว้ ${MAX_BACKUPS} ล่าสุด)${NC}"
  ls -1t "${BACKUP_DIR}"/450k_*.sqlite | tail -n "$DELETE_COUNT" | xargs rm -f
fi

# ── แสดงรายการ backup ทั้งหมด ──────────────────
echo ""
echo -e "${BOLD}📁 Backup ที่มีทั้งหมด (${BACKUP_DIR}):${NC}"
ls -lht "${BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | \
  awk '{printf "   %s  %s  %s\n", $6, $7, $9}' | head -10
echo ""
echo -e "รวม: $(ls -1 "${BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | wc -l) ไฟล์"
echo ""

# ========================================
# วิธีตั้ง Auto Backup ด้วย Cron (ทำครั้งเดียว)
# ========================================
# รัน: crontab -e
# แล้วเพิ่มบรรทัดนี้ (backup ทุกวันตี 2):
#   0 2 * * * /path/to/450k-runner/backup.sh >> /path/to/450k-runner/backend/data/backups/backup.log 2>&1
#
# ตรวจสอบ cron: crontab -l
# ดู log: tail -f /path/to/450k-runner/backend/data/backups/backup.log
# ========================================
