import { Participant, WeeklyData, Season, Distance, Milestone } from '@/types';

export const PARTICIPANTS: Participant[] = [
  { id:1,name:'ครูสมชาย วงษ์ดี',initials:'สช',km:187.3,steps:248600,streak:48,weeklyKm:28.5,activityCount:22 },
  { id:2,name:'ครูวรรณา สุขใจ',initials:'วน',km:165.2,steps:218400,streak:41,weeklyKm:22.1,activityCount:19 },
  { id:3,name:'ครูประสิทธิ์ มั่นคง',initials:'ปส',km:152.8,steps:201300,streak:38,weeklyKm:19.8,activityCount:17 },
  { id:4,name:'ครูนงลักษณ์ ดีงาม',initials:'นล',km:138.4,steps:185200,streak:35,weeklyKm:21.2,activityCount:16 },
  { id:5,name:'ครูอรทัย พรมมาศ',initials:'อท',km:124.6,steps:168900,streak:29,weeklyKm:18.4,activityCount:14 },
  { id:6,name:'ครูสุรชัย บุญมา',initials:'สร',km:118.3,steps:156200,streak:27,weeklyKm:16.7,activityCount:13 },
  { id:7,name:'ครูมาลี ศิริรัตน์',initials:'มล',km:105.7,steps:142800,streak:24,weeklyKm:15.3,activityCount:12 },
  { id:8,name:'ครูชัยวัฒน์ ใจดี',initials:'ชว',km:98.2,steps:131600,streak:22,weeklyKm:14.8,activityCount:11 },
  { id:9,name:'ครูพรทิพย์ สง่างาม',initials:'พท',km:87.5,steps:118400,streak:19,weeklyKm:12.6,activityCount:10 },
  { id:10,name:'ครูณัฐพล รักเรียน',initials:'ณพ',km:74.1,steps:101200,streak:16,weeklyKm:11.2,activityCount:9 },
  { id:11,name:'ครูสุนีย์ จงดี',initials:'สน',km:62.8,steps:87500,streak:14,weeklyKm:9.8,activityCount:8 },
  { id:12,name:'ครูกิตติพงษ์ แสงทอง',initials:'กต',km:51.3,steps:72600,streak:11,weeklyKm:8.4,activityCount:7 },
  { id:13,name:'ครูอัญชลี วรรณกุล',initials:'อช',km:43.6,steps:61200,streak:9,weeklyKm:7.1,activityCount:6 },
  { id:14,name:'ครูวิชัย พงษ์ไทย',initials:'วช',km:32.4,steps:45800,streak:7,weeklyKm:5.9,activityCount:5 },
  { id:15,name:'ครูปราณี สมใจ',initials:'ปน',km:18.9,steps:26400,streak:4,weeklyKm:4.2,activityCount:3 },
];

export const TOTAL_KM = PARTICIPANTS.reduce((s,p)=>s+p.km,0);
export const GOAL_KM = 450;

export const WEEKLY_DATA: WeeklyData[] = [
  {week:'สัปดาห์ 1',km:42.3,steps:58400},
  {week:'สัปดาห์ 2',km:61.8,steps:84200},
  {week:'สัปดาห์ 3',km:78.4,steps:104600},
  {week:'สัปดาห์ 4',km:95.2,steps:127800},
  {week:'สัปดาห์ 5',km:112.6,steps:148300},
  {week:'สัปดาห์ 6',km:134.1,steps:173900},
  {week:'สัปดาห์ 7',km:152.5,steps:198200},
  {week:'สัปดาห์ 8',km:168.8,steps:218600},
];

export const SEASONS: Season[] = [
  { name:'Season 1', subtitle:'มิถุนายน 2569', dateRange:'1–30 มิ.ย. 69', status:'done', topKm:62.4, totalKm:148.3, participants:15, winner:'ครูสมชาย วงษ์ดี' },
  { name:'Season 2', subtitle:'กรกฎาคม 2569', dateRange:'1–31 ก.ค. 69', status:'active', topKm:38.7, totalKm:128.6, participants:15, winner:'-' },
  { name:'Season 3', subtitle:'สิงหาคม–กันยายน', dateRange:'1 ส.ค.–30 ก.ย. 69', status:'upcoming', topKm:0, totalKm:0, participants:0, winner:'-' },
];

export const DISTANCES: Distance[] = [
  { km:30, label:'กรุงเทพฯ (สยาม)', icon:'🏙️', desc:'ออกจากสมุทรสาครถึงใจกลางกรุงเทพฯ', gmapUrl:'https://maps.google.com/?saddr=โรงเรียนอนุสรณ์ศุภมาศ+สมุทรสาคร&daddr=สยาม+กรุงเทพ' },
  { km:50, label:'นครปฐม', icon:'🛕', desc:'ถึงพระปฐมเจดีย์ สถูปที่สูงที่สุดในโลก', gmapUrl:'https://maps.google.com/?saddr=โรงเรียนอนุสรณ์ศุภมาศ+สมุทรสาคร&daddr=วัดพระปฐมเจดีย์+นครปฐม' },
  { km:100, label:'ราชบุรี', icon:'🏔️', desc:'ถึงเมืองไห ดินแดนแห่งโอ่งมังกร', gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ราชบุรี' },
  { km:200, label:'เพชรบุรี', icon:'🏖️', desc:'ถึงเมืองชายทะเลสวยงาม', gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=เพชรบุรี' },
  { km:300, label:'ประจวบคีรีขันธ์', icon:'🌊', desc:'ถึงเมืองอ่าวมะนาว วิวทะเลงาม', gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ประจวบคีรีขันธ์' },
  { km:450, label:'ชุมพร', icon:'🌴', desc:'ถึงประตูสู่ภาคใต้ ครบ 450 km!', gmapUrl:'https://maps.google.com/?saddr=สมุทรสาคร&daddr=ชุมพร' },
];

export const MILESTONES: Milestone[] = [
  { km:50, reward:'พวงกุญแจโครงการ', icon:'🔑', color:'#FF8C35', bg:'rgba(255,140,53,0.15)', achievers: PARTICIPANTS.filter(p=>p.km>=50).length },
  { km:250, reward:'กระบอกน้ำ Sport Bottle / ผ้าขนหนูนาโน', icon:'🧴', color:'#9B30FF', bg:'rgba(155,48,255,0.15)', achievers: PARTICIPANTS.filter(p=>p.km>=250).length },
  { km:450, reward:'เงินรางวัล 500 บาท + ถ้วยรางวัล (ผู้ชนะอันดับ 1)', icon:'🏆', color:'#FFD700', bg:'rgba(255,215,0,0.15)', achievers: PARTICIPANTS.filter(p=>p.km>=450).length },
  { km:0, reward:'เกียรติบัตรออนไลน์ (ผู้เข้าร่วมทุกคน)', icon:'📜', color:'#FF2D9B', bg:'rgba(255,45,155,0.15)', achievers: PARTICIPANTS.length },
];
