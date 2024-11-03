import express from 'express';
import { BaseQueueRequest } from '../models';

import { IQueueOperationBroker } from '../services/queueOperationBrokerService';
import { IQueueOperationsDb } from '../services/queueOperationsDbService';

function creatAdminRouter(
  queueOperations: IQueueOperationBroker,
  db: IQueueOperationsDb
) {
  const router = express.Router();

  router.post(
    '/next',
    (req: express.Request<unknown, unknown, BaseQueueRequest>, res) => {
      try {
        queueOperations.next(req.body.queueId).catch(console.error);

        res.json({ ok: true });
      } catch (e) {
        res.json({ ok: false, error: e });
      }
    }
  );

  router.get('/meta', async (req, res) => {
    const meta = await db.getQueueMeta(req.query.queueId as string);

    res.json(meta);
  });

  return router;
}
export default creatAdminRouter;
