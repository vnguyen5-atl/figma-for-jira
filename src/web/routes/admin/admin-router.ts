import { Router } from 'express';

import { authRouter } from './auth';
import { teamsRouter } from './teams';

import { forgeInvocationTokenMiddleware } from '../../middleware/forge';

export const adminRouter = Router();

adminRouter.use(forgeInvocationTokenMiddleware);

adminRouter.use('/auth', authRouter);
adminRouter.use('/teams', teamsRouter);
