import express from 'express';

import * as ctrl from '../controllers/mine.controller';
import * as val from '../validators/mine.validator';

export {ee} from '../controllers/mine.controller';

export const router = express.Router();
router.get('/', val.getMiner, ctrl.getMiner);
