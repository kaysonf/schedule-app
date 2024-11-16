import express from 'express';
import { BaseQueueRequest } from '../models';

import { IQueueOperationProducer } from '../services/QueueOperationProducer';
import { logger } from '../logger';

function creatAdminRouter(queueOperations: IQueueOperationProducer) {
  const router = express.Router();

  router.post(
    '/serve',
    (
      req: express.Request<
        unknown,
        unknown,
        BaseQueueRequest & { joinId: string }
      >,
      res
    ) => {
      try {
        queueOperations
          .serve(req.body.queueId, req.body.joinId)
          .catch(logger.error);

        res.json({ ok: true });
      } catch (e) {
        res.json({ ok: false, error: e });
      }
    }
  );

  return router;
}
export default creatAdminRouter;
