import express from 'express';
import { BaseQueueRequest } from '../models';

import { IQueueOperationBroker } from '../services/queueOperationBrokerService';
import { logger } from '../logger';

function createCustomerRouter(queueOperations: IQueueOperationBroker) {
  const router = express.Router();

  router.post(
    '/queue',
    (req: express.Request<unknown, unknown, BaseQueueRequest>, res) => {
      try {
        queueOperations.joinQueue(req.body.queueId).catch(logger.error);

        res.json({ ok: true });
      } catch (e) {
        res.json({ ok: false, error: e });
      }
    }
  );

  return router;
}
export default createCustomerRouter;
