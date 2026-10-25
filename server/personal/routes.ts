import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config.ts";
import type { Sessions } from "../auth/sessions.ts";
import { protectedSessionRoute, sessionInput } from "../auth/routes.ts";
import { applyPersonal, readPersonal } from "./repository.ts";

export function personalRoutes(app: FastifyInstance, config: ServerConfig, sessions: Sessions) {
  app.get("/api/v1/personal", protectedSessionRoute(config, async request => sessions.asActor(sessionInput(request, config), false, (client, actor) => readPersonal(client, actor)), false, "personal"));
  app.post("/api/v1/personal/commands", { bodyLimit: 64 * 1024 }, protectedSessionRoute(config, async request => sessions.asActor(sessionInput(request, config), true, (client, actor) => applyPersonal(client, actor, request.body)), true, "personal"));
}
