import express from 'express';

import * as ctrl from '../controllers/mempool.controller';
import * as val from '../validators/mempool.validator';

export const router = express.Router();
router.get('/', val.getTxs, ctrl.getTxs);
