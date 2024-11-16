import express from 'express';
import { BaseQueueRequest } from '../models';
import { IQueueOperationProducer } from '../services/QueueOperationProducer';

function createCustomerRouter(queueOperations: IQueueOperationProducer) {
  const router = express.Router();

  router.post(
    '/queue',
    async (req: express.Request<unknown, unknown, BaseQueueRequest>, res) => {
      try {
        const result = await queueOperations.joinQueue(req.body.queueId);

        res.json({ ok: true, joinId: result.joinId });
      } catch (e) {
        res.json({ ok: false, error: e });
      }
    }
  );

  return router;
}
export default createCustomerRouter;
