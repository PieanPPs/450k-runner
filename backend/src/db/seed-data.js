// participants จะถูก auto-discover จาก Strava Club เมื่อ sync ครั้งแรก
// ไว้ที่นี่แค่ admin (participant_id=1) ที่ต้อง connect OAuth ก่อน
export const participants = [
  { id:1, name:'พีรพงษ์', initials:'พพ', km:0, steps:0, streak:0, weeklyKm:0 },
];

export const weeklyData = [];

export const seasons = [
  { name:'Season 1', subtitle:'มิถุนายน 2569', dateRange:'1–30 มิ.ย. 69', status:'upcoming', topKm:0, totalKm:0, participants:15, winner:'-' },
];

export const distances = [
  { km:30,  label:'กรุงเทพฯ (สยาม)',  icon:'🏙️', description:'ออกจากสมุทรสาครถึงใจกลางกรุงเทพฯ',        gmapUrl:'https://maps.google.com/?saddr=โรงเรียนอนุสรณ์ศุภมาศ+สมุทรสาคร&daddr=สยาม+กรุงเทพ' },
  { km:50,  label:'นครปฐม',           icon:'🛕',  description:'ถึงพระปฐมเจดีย์ สถูปที่สูงที่สุดในโลก', gmapUrl:'https://maps.google.com/?saddr=โรงเรียนอนุสรณ์ศุภมาศ+สมุทรสาคร&daddr=วัดพระปฐมเจดีย์+นครปฐม' },
  { km:100, label:'ราชบุรี',          icon:'🏔️', description:'ถึงเมืองไห ดินแดนแห่งโอ่งมังกร',           gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ราชบุรี' },
  { km:200, label:'เพชรบุรี',         icon:'🏖️', description:'ถึงเมืองชายทะเลสวยงาม',                  gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=เพชรบุรี' },
  { km:300, label:'ประจวบคีรีขันธ์',  icon:'🌊', description:'ถึงเมืองอ่าวมะนาว วิวทะเลงาม',             gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ประจวบคีรีขันธ์' },
  { km:450, label:'ชุมพร',           icon:'🌴', description:'ถึงประตูสู่ภาคใต้ ครบ 450 km!',             gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ชุมพร' },
];

export const milestones = [
  { km:50,  reward:'พวงกุญแจโครงการ',                                 icon:'🔑', color:'#FF8C35', bg:'rgba(255,140,53,0.15)'  },
  { km:250, reward:'กระบอกน้ำ Sport Bottle / ผ้าขนหนูนาโน',            icon:'🧴', color:'#9B30FF', bg:'rgba(155,48,255,0.15)'  },
  { km:450, reward:'เงินรางวัล 500 บาท + ถ้วยรางวัล (อันดับ 1)',       icon:'🏆', color:'#FFD700', bg:'rgba(255,215,0,0.15)'   },
  { km:0,   reward:'เกียรติบัตรออนไลน์ (ผู้เข้าร่วมทุกคน)',             icon:'📜', color:'#FF2D9B', bg:'rgba(255,45,155,0.15)' },
];
