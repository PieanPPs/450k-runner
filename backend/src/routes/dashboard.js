import { Router } from 'express';
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
} from '../controllers/dashboardController.js';

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

export default router;
