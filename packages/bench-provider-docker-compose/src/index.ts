/**
 * @witylogix/bench-provider-docker-compose
 *
 * Default provider for Witylogix Bench. Generates a docker-compose.yml
 * from bench.config.yaml and drives `docker compose up`, `down`, `logs`, etc.
 */

export {
  DockerComposeProvider,
  createDockerComposeProvider,
} from "./provider.js";
export { generateCompose, APP_SERVICES, DEFAULT_PORTS } from "./compose.js";
