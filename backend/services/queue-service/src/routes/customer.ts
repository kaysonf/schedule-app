import express from 'express';
import { BaseQueueRequest } from '../models';

import { IQueueOperationBroker } from '../services/queueOperationBrokerService';

function createCustomerRouter(queueOperations: IQueueOperationBroker) {
  const router = express.Router();

  router.post(
    '/queue',
    (req: express.Request<unknown, unknown, BaseQueueRequest>, res) => {
      try {
        queueOperations.joinQueue(req.body.queueId).catch(console.error);

        res.json({ ok: true });
      } catch (e) {
        res.json({ ok: false, error: e });
      }
    }
  );

  return router;
}
export default createCustomerRouter;
