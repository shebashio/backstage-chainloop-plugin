// File: backstage/plugins/chainloop-backend/src/models/webhookModel.ts

import { Knex } from 'knex';

export class WebhookModel {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
    this.ensureTableExists();
  }

  async ensureTableExists() {
    const exists = await this.db.schema.hasTable('webhook_payloads');
    if (!exists) {
      await this.db.schema.createTable('webhook_payloads', table => {
        table.increments('id').primary();
        table.string('entity_uid').notNullable();
        table.json('payload').notNullable();
        table.timestamps(true, true);
        // Uncomment the line below if you have a 'catalog_entities' table with a 'uid' column
        // table.foreign('entity_uid').references('uid').inTable('catalog_entities').onDelete('CASCADE');
      });
    }
  }

  /**
   * Saves a webhook payload associated with a specific entity UID.
   * @param payload The webhook payload.
   * @param entityUid The UID of the associated Backstage catalog entity.
   */
  async savePayload(payload: any, entityUid: string) {
    await this.db('webhook_payloads').insert({
      entity_uid: entityUid,
      payload: JSON.stringify(payload),
    });
  }

  /**
   * Retrieves a specific webhook payload by its ID.
   * @param id The ID of the webhook payload.
   * @returns The webhook payload record or undefined if not found.
   */
  async getPayloadById(id: number) {
    return await this.db('webhook_payloads').where({ id }).first();
  }

  /**
   * Retrieves paginated and searchable webhook payloads for a specific entity UID.
   * @param entityUid The UID of the Backstage catalog entity.
   * @param searchQuery The search query string.
   * @param page The current page number (1-based).
   * @param limit The number of records per page.
   * @returns An object containing the records and the total count.
   */
  async getPayloads(entityUid: string, searchQuery: string, page: number, limit: number) {
    let query = this.db('webhook_payloads').where({ entity_uid: entityUid });

    if (searchQuery) {
      // Adjust the JSON path based on your actual payload structure
      query = query.andWhereRaw(
        `payload->'$.Metadata.Workflow.Name' LIKE ?`,
        [`%${searchQuery}%`]
      );
    }

    const records = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    console.log(records);
    const totalResult = await this.db('webhook_payloads').where({ entity_uid: entityUid }).count('id as count').first();
    console.log(totalResult);
    const total = totalResult?.count ? parseInt(totalResult.count, 10) : 0;
    // delete the last record to avoid duplicates
    records.pop();

    return {
      records: records.map(record => ({
        id: record.id,
        created_at: record.created_at,
        updated_at: record.updated_at,
        workflow: record.payload.Metadata?.Workflow,
        workflowRun: record.payload.Metadata?.WorkflowRun,
        kind: record.payload.Kind,
      })),
      total,
    };
  }
}