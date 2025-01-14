// File: backstage/plugins/chainloop-backend/src/service/router.ts

import { errorHandler } from '@backstage/backend-common';
import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { WebhookModel } from '../models/webhookModel';
import { Config } from '@backstage/config';

export interface RouterOptions {
  logger: LoggerService;
  database: any;
  config: Config;
}

// Extend Express Request interface to include entityUid
declare global {
  namespace Express {
    interface Request {
      entityUid?: string;
    }
  }
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, database, config } = options;
  const db = await database.getClient();

  const webhookModel = new WebhookModel(db);

  const router = Router();
  router.use(express.json({ limit: '50mb' })); // Increase body size limit

  // Retrieve the webhook token from config
  const webhookToken = config.getString('chainloop.webhookToken');

  /**
   * Middleware to verify the webhook token.
   */
  const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.query.token;
    if (token !== webhookToken) {
      logger.warn(`Unauthorized webhook attempt with token: ${token}`);
      return res.status(401).json({ status: 'unauthorized', message: 'Invalid or missing token' });
    }
    next();
  };

  /**
   * Middleware to verify entity access and extract entityUid.
   * Here, entityUid is extracted from the URL parameter.
   */
  const verifyEntityAccess = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const entityUid = req.params.uid;
    if (!entityUid) {
      return res.status(400).json({ status: 'error', message: 'Missing entity UID in URL' });
    }
    req.entityUid = entityUid; // Attach to request object for downstream handlers
    next();
  };

  /**
   * Health Check Endpoint
   */
  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  /**
   * Echo Endpoint for Testing
   */
  router.post('/echo', (request, response) => {
    console.log(request.body);
    response.status(200).json({ status: 'ok' });
  });

  /**
   * Entity-Specific Webhook Endpoint
   * URL: /api/chainloop/entity/:uid/webhook?token=...
   */
  router.post('/entity/:uid/webhook', verifyToken, async (request, response) => {
    try {
      console.log(request.body);
      const payload = request.body;
      // get uid from url
      const entityUidFromURL = request.params.uid;
      if (!entityUidFromURL) {
        return response.status(400).json({ status: 'error', message: 'Missing entity UID in URL' });
      }

      await webhookModel.savePayload(payload, entityUidFromURL);
      response.status(201).json({ status: 'saved' });
    } catch (error) {
      logger.error('Failed to save payload', error);
      response.status(500).json({ status: 'error', message: 'Failed to save payload' });
    }
  });

  /**
   * Records Retrieval Endpoint
   * URL: /api/chainloop/records?entityUid=...&search=...&page=...&limit=...
   * Supports pagination and search.
   */
  router.get('/records', async (request, response) => {
    console.log("Request", request.query);
    
    try {
      const entityUid = request.query.entityUid as string;
      const searchQuery = (request.query.search as string) || '';
      const page = parseInt(request.query.page as string, 10) || 1;
      const limit = parseInt(request.query.limit as string, 10) || 10;

      const { records, total } = entityUid
        ? await webhookModel.getPayloads(entityUid, searchQuery, page, limit)
        : await webhookModel.getAllPayloads(searchQuery, page, limit);

      response.status(200).json({ records, total });
    } catch (error) {
      logger.error('Failed to fetch records', error);
      response.status(500).json({ status: 'error', message: 'Failed to fetch records' });
    }
  });

  /**
   * Record Details Retrieval Endpoint
   * URL: /api/chainloop/details/:id?entityUid=...
   * Ensures the record belongs to the requested entity.
   */
  router.get('/details/:id', async (request, response) => {
    try {
      const { id } = request.params;
      const entityUid = request.query.entityUid as string;
      if (!entityUid) {
        return response.status(400).json({ status: 'error', message: 'Missing entityUid parameter' });
      }

      const recordId = parseInt(id, 10);
      const record = await webhookModel.getPayloadById(recordId);
      if (!record || record.entity_uid !== entityUid) {
        return response.status(404).json({ status: 'error', message: 'Record not found' });
      }
      console.log("Record", record);
      response.status(200).json(record);
    } catch (error) {
      logger.error('Failed to fetch record details', error);
      response.status(500).json({ status: 'error', message: 'Failed to fetch record details' });
    }
  });

  /**
   * Error Handling Middleware
   */
  router.use(errorHandler());

  return router;
}