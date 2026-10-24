import { Router } from '../lib/asyncRouter.js';
import {
  getParticipants,
  getLeaderboard,
  getWeekly,
  getWeeklySnapshots,
  getSeasons,
  getDistances,
  getMilestones,
  getSummary,
  getGallery,
  getSettings,
  getDailyLog,
  getImprovement,
  getBadges,
} from '../controllers/dashboardController.js';

import { getStages } from '../lib/stages.js';

const router = Router();

router.get('/participants', getParticipants);
router.get('/leaderboard', getLeaderboard);
router.get('/weekly', getWeekly);
router.get('/weekly-snapshots', getWeeklySnapshots);
router.get('/seasons', getSeasons);
router.get('/distances', getDistances);
router.get('/milestones', getMilestones);
router.get('/summary', getSummary);
router.get('/gallery', getGallery);
router.get('/settings', getSettings);
router.get('/daily', getDailyLog);
router.get('/improvement', getImprovement);
router.get('/badges', getBadges);
// ด่านรายสัปดาห์ (gamification)
router.get('/stages', async (_req, res) => res.json(await getStages()));

export default router;
