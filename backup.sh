#!/bin/bash
# ========================================
# backup.sh — Backup ฐานข้อมูล 450K Runner
# วิธีใช้ (manual): bash /home/450k-runner/backup.sh
# WAL-safe: ใช้ Node.js better-sqlite3 db.backup() ผ่าน Docker
# ========================================

CONTAINER="backend-450k"
HOST_BACKUP_DIR="/home/450k-runner/db-backups"   # นอก Docker — ปลอดภัยกว่า
MAX_BACKUPS=90                                     # เก็บ 90 วัน (3 เดือน)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}💾 Backup 450K Database${NC} — $(date '+%Y-%m-%d %H:%M:%S')"

# ── ตรวจสอบ container ──────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}❌ Container '${CONTAINER}' ไม่ได้ทำงานอยู่${NC}"
  exit 1
fi

# ── สร้าง host backup directory ────────────────
mkdir -p "$HOST_BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
CONTAINER_DEST="/app/data/backups/manual_${TIMESTAMP}.sqlite"
HOST_DEST="${HOST_BACKUP_DIR}/450k_${TIMESTAMP}.sqlite"

# ── Backup ผ่าน Node.js (WAL-safe) ─────────────
docker exec "$CONTAINER" node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/450k.sqlite');
db.backup('${CONTAINER_DEST}').then(() => {
  console.log('ok');
}).catch(e => { console.error(e.message); process.exit(1); });
"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Backup ล้มเหลว (Docker/Node error)${NC}"
  exit 1
fi

# ── Copy ออกมาไว้นอก Docker volume (host filesystem) ──
docker cp "${CONTAINER}:${CONTAINER_DEST}" "$HOST_DEST"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$HOST_DEST" | cut -f1)
  echo -e "${GREEN}✅ Backup สำเร็จ${NC}"
  echo -e "   📦 ใน Docker : ${CONTAINER_DEST}"
  echo -e "   💾 บน Host   : ${HOST_DEST} (${SIZE})"
else
  echo -e "${YELLOW}⚠️  Backup อยู่ใน Docker แต่ copy ออก host ไม่สำเร็จ${NC}"
fi

# ── ลบ host backup เก่าเกิน MAX_BACKUPS ────────
BACKUP_COUNT=$(ls -1 "${HOST_BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
  echo -e "${YELLOW}🗑️  ลบ backup เก่า ${DELETE_COUNT} ไฟล์${NC}"
  ls -1t "${HOST_BACKUP_DIR}"/450k_*.sqlite | tail -n "$DELETE_COUNT" | xargs rm -f
fi

# ── แสดงรายการ backup ล่าสุด 10 ไฟล์ ──────────
echo ""
echo -e "${BOLD}📁 Backup ล่าสุด (${HOST_BACKUP_DIR}):${NC}"
ls -lht "${HOST_BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | \
  awk '{printf "   %s %s  %s  %s\n", $6, $7, $5, $9}' | head -10
echo ""
echo -e "รวม: $(ls -1 "${HOST_BACKUP_DIR}"/450k_*.sqlite 2>/dev/null | wc -l) ไฟล์"
echo ""

# ========================================
# วิธีตั้ง Auto Backup ด้วย Cron (ทำครั้งเดียว)
# crontab -e แล้วเพิ่ม:
#   0 2 * * * /home/450k-runner/backup.sh >> /home/450k-runner/db-backups/backup.log 2>&1
# ========================================
