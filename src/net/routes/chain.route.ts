import express from 'express';

import * as ctrl from '../controllers/chain.controller';
import * as val from '../validators/chain.validator';

export const router = express.Router();
router.get('/', val.getChain, ctrl.getChain);
