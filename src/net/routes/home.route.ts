import express from 'express';

import * as ctrl from '../controllers/home.controller';
import * as val from '../validators/home.validator';

export const router = express.Router();

router.get('/', val.getHome, ctrl.getHome);
