// File: backstage/plugins/chainloop-backend/src/plugin.ts

import {
  coreServices,
  createBackendPlugin,
} from "@backstage/backend-plugin-api";
import { createRouter } from "./service/router";

/**
 * chainloopPlugin backend plugin
 *
 * @public
 */
export const chainloopPlugin = createBackendPlugin({
  pluginId: "chainloop",
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        database: coreServices.database,
        config: coreServices.rootConfig, // Add config dependency
      },
      async init({ httpRouter, logger, database, config }) {
        httpRouter.use(
          await createRouter({
            logger,
            database,
            config, // Pass config to createRouter
          })
        );

        // Define authentication policies for various routes
        httpRouter.addAuthPolicy({
          path: "/health",
          allow: "unauthenticated",
        });
        httpRouter.addAuthPolicy({
          path: "/echo",
          allow: "unauthenticated",
        });
        httpRouter.addAuthPolicy({
          path: "/entity",
          allow: "unauthenticated",
        });
        // Remove /webhook from unauthenticated access as it's now secured
        // If you had previously allowed unauthenticated access to /webhook, remove or comment it out
        // httpRouter.addAuthPolicy({
        //   path: '/webhook',
        //   allow: 'unauthenticated',
        // });
      },
    });
  },
});
