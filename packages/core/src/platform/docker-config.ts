/**
 * Docker Compose Configuration Generator
 *
 * Generates production-ready Docker Compose manifests with:
 * - Service definitions (API, dashboard, worker, DB, cache)
 * - Health checks and dependencies
 * - Volume mounts and networking
 * - Environment variable templates
 * - Nginx reverse proxy configuration
 */

// ─── Types ──────────────────────────────────────────────────────

export type EnvironmentType = "development" | "staging" | "production";

export interface DockerComposeService {
  image?: string;
  build?: {
    context: string;
    dockerfile: string;
  };
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: Record<string, any>;
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    start_period?: string;
  };
  restart?: string;
  command?: string;
  networks?: string[];
}

export interface DockerComposeConfig {
  version: string;
  services: Record<string, DockerComposeService>;
  volumes: Record<string, any>;
  networks: Record<string, any>;
}

// ─── Docker Compose Generator ───────────────────────────────────

export class DockerComposeGenerator {
  /**
   * Generate Docker Compose configuration for environment
   */
  public static generateDockerCompose(env: EnvironmentType): string {
    const isDev = env === "development";
    const isProd = env === "production";

    const config: DockerComposeConfig = {
      version: "3.9",
      services: {
        // Reverse Proxy
        nginx: {
          image: "nginx:1.25-alpine",
          ports: isProd ? ["80:80", "443:443"] : ["80:80"],
          volumes: [
            "./nginx.conf:/etc/nginx/nginx.conf:ro",
            ...(isProd ? ["./certs:/etc/nginx/certs:ro"] : []),
            "./logs/nginx:/var/log/nginx",
          ],
          depends_on: {
            api: {
              condition: "service_healthy",
            },
            ...(isProd
              ? {
                  dashboard: {
                    condition: "service_healthy",
                  },
                }
              : {}),
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },

        // API Server
        api: {
          build: {
            context: ".",
            dockerfile: "Dockerfile",
          },
          ports: ["3000"],
          environment: {
            NODE_ENV: env,
            LOG_LEVEL: isDev ? "debug" : "info",
            DATABASE_URL:
              "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}",
            REDIS_URL: "redis://redis:6379",
            JWT_SECRET: "${JWT_SECRET}",
            JWT_EXPIRES_IN: "24h",
            ...(isProd
              ? {
                  API_URL: "https://${API_DOMAIN}",
                }
              : {
                  API_URL: "http://localhost:3000",
                }),
          },
          volumes: [
            "./logs/api:/app/logs",
            ...(isDev ? ["./packages/core/src:/app/packages/core/src"] : []),
          ],
          depends_on: {
            postgres: {
              condition: "service_healthy",
            },
            redis: {
              condition: "service_healthy",
            },
          },
          healthcheck: {
            test: ["CMD", "curl", "-f", "http://localhost:3000/health"],
            interval: "10s",
            timeout: "5s",
            retries: 3,
            start_period: "30s",
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },

        // Dashboard
        dashboard: {
          build: {
            context: "./apps/dashboard",
            dockerfile: "Dockerfile",
          },
          ports: ["3001"],
          environment: {
            NEXT_PUBLIC_API_URL: isProd
              ? "https://${API_DOMAIN}"
              : "http://localhost:3000",
          },
          depends_on: {
            api: {
              condition: "service_healthy",
            },
          },
          healthcheck: {
            test: ["CMD", "curl", "-f", "http://localhost:3001/health"],
            interval: "10s",
            timeout: "5s",
            retries: 3,
            start_period: "30s",
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },

        // Background Worker
        worker: {
          build: {
            context: ".",
            dockerfile: "Dockerfile",
          },
          command: "node dist/apps/api/src/workers/queue-worker.js",
          environment: {
            NODE_ENV: env,
            LOG_LEVEL: isDev ? "debug" : "info",
            DATABASE_URL:
              "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}",
            REDIS_URL: "redis://redis:6379",
            WORKER_CONCURRENCY: isDev ? "2" : "10",
          },
          volumes: ["./logs/worker:/app/logs"],
          depends_on: {
            postgres: {
              condition: "service_healthy",
            },
            redis: {
              condition: "service_healthy",
            },
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },

        // PostgreSQL Database
        postgres: {
          image: "postgres:16-alpine",
          ports: isDev ? ["5432:5432"] : [],
          environment: {
            POSTGRES_USER: "${POSTGRES_USER}",
            POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}",
            POSTGRES_DB: "${POSTGRES_DB}",
            POSTGRES_INITDB_ARGS: "-c max_connections=200",
          },
          volumes: [
            "postgres_data:/var/lib/postgresql/data",
            ...(isDev
              ? [
                  "./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql",
                ]
              : []),
          ],
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"],
            interval: "10s",
            timeout: "5s",
            retries: 5,
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },

        // Redis Cache
        redis: {
          image: "redis:7-alpine",
          ports: isDev ? ["6379:6379"] : [],
          volumes: ["redis_data:/data"],
          command: "redis-server --appendonly yes",
          healthcheck: {
            test: ["CMD", "redis-cli", "ping"],
            interval: "10s",
            timeout: "5s",
            retries: 5,
          },
          restart: isProd ? "unless-stopped" : "on-failure",
          networks: ["witylogix"],
        },
      },

      volumes: {
        postgres_data: {
          driver: "local",
        },
        redis_data: {
          driver: "local",
        },
      },

      networks: {
        witylogix: {
          driver: "bridge",
        },
      },
    };

    return this.formatYAML(config);
  }

  /**
   * Generate environment variables template
   */
  public static generateEnvTemplate(env: EnvironmentType): string {
    const isDev = env === "development";
    const comments: Record<string, string> = {
      NODE_ENV: "Environment: development, staging, production",
      LOG_LEVEL: "Logging level: debug, info, warn, error",
      DATABASE_URL: "PostgreSQL connection string (required)",
      POSTGRES_USER: "PostgreSQL username (default: postgres)",
      POSTGRES_PASSWORD: "PostgreSQL password (MUST be secure in production)",
      POSTGRES_DB: "PostgreSQL database name (default: witylogix)",
      REDIS_URL: "Redis connection URL (required)",
      JWT_SECRET: "JWT signing secret (32+ characters, must be secure)",
      JWT_EXPIRES_IN: "JWT expiration time (default: 24h)",
      API_DOMAIN: "API domain for production (e.g., api.witylogix.com)",
      API_URL: "Public API URL for CORS and redirects",
      CORS_ORIGIN: "Comma-separated CORS origins",
      WORKER_CONCURRENCY: "Number of parallel job workers (default: 10)",
    };

    const lines: string[] = [];

    for (const [key, comment] of Object.entries(comments)) {
      lines.push(`# ${comment}`);

      switch (key) {
        case "NODE_ENV":
          lines.push(`NODE_ENV=${env}`);
          break;
        case "LOG_LEVEL":
          lines.push(`LOG_LEVEL=${isDev ? "debug" : "info"}`);
          break;
        case "DATABASE_URL":
          lines.push(
            `DATABASE_URL=postgresql://${isDev ? "postgres:password" : "${POSTGRES_USER}:${POSTGRES_PASSWORD}"}@postgres:5432/${isDev ? "witylogix" : "${POSTGRES_DB}"}`,
          );
          break;
        case "POSTGRES_USER":
          lines.push(`POSTGRES_USER=${isDev ? "postgres" : "change_me"}`);
          break;
        case "POSTGRES_PASSWORD":
          lines.push(
            `POSTGRES_PASSWORD=${isDev ? "password" : "change_me_secure_password_32_chars"}`,
          );
          break;
        case "POSTGRES_DB":
          lines.push(`POSTGRES_DB=${isDev ? "witylogix" : "witylogix_prod"}`);
          break;
        case "REDIS_URL":
          lines.push(`REDIS_URL=redis://redis:6379`);
          break;
        case "JWT_SECRET":
          lines.push(
            `JWT_SECRET=${isDev ? "dev-secret-change-me" : "generate-secure-random-32-character-secret"}`,
          );
          break;
        case "JWT_EXPIRES_IN":
          lines.push(`JWT_EXPIRES_IN=24h`);
          break;
        case "API_DOMAIN":
          lines.push(`API_DOMAIN=${isDev ? "localhost" : "api.witylogix.com"}`);
          break;
        case "API_URL":
          lines.push(
            `API_URL=${isDev ? "http://localhost:3000" : "https://api.witylogix.com"}`,
          );
          break;
        case "CORS_ORIGIN":
          lines.push(
            `CORS_ORIGIN=${isDev ? "http://localhost:3001" : "https://app.witylogix.com"}`,
          );
          break;
        case "WORKER_CONCURRENCY":
          lines.push(`WORKER_CONCURRENCY=${isDev ? "2" : "10"}`);
          break;
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate Nginx reverse proxy configuration
   */
  public static generateNginxConfig(): string {
    return `
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
  worker_connections 2048;
  use epoll;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent" "$http_x_forwarded_for" '
                  'rt=$request_time uct="$upstream_connect_time" '
                  'uht="$upstream_header_time" urt="$upstream_response_time"';

  access_log /var/log/nginx/access.log main;

  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout 65;
  types_hash_max_size 2048;
  client_max_body_size 20M;

  # Gzip compression
  gzip on;
  gzip_vary on;
  gzip_min_length 1000;
  gzip_types text/plain text/css text/xml text/javascript
             application/x-javascript application/xml+rss
             application/javascript application/json;

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
  limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

  # Upstream services
  upstream api {
    least_conn;
    server api:3000;
  }

  upstream dashboard {
    server dashboard:3001;
  }

  # HTTP to HTTPS redirect (production only)
  server {
    listen 80 default_server;
    server_name _;

    # Health check endpoint
    location /health {
      access_log off;
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
    }

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }

    # Redirect all other HTTP to HTTPS
    location / {
      return 301 https://$host$request_uri;
    }
  }

  # HTTPS server
  server {
    listen 443 ssl http2 default_server;
    server_name _;

    # SSL certificates (production)
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API routes
    location /api/ {
      limit_req zone=api_limit burst=20 nodelay;

      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Request-ID $request_id;

      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;

      # WebSocket support
      proxy_buffering off;
    }

    # Health check endpoint
    location /health {
      access_log off;
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
    }

    # Dashboard routes
    location / {
      limit_req zone=general_limit burst=50 nodelay;

      proxy_pass http://dashboard;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;

      # Cache static assets
      location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
      }
    }
  }

  # Metrics endpoint (internal only)
  server {
    listen 9090;
    server_name localhost;

    location /metrics {
      proxy_pass http://api;
    }
  }
}
`;
  }

  /**
   * Convert object to YAML format
   */
  private static formatYAML(obj: any, indent: number = 0): string {
    const spaces = " ".repeat(indent);
    const lines: string[] = [];

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          lines.push(`${spaces}- ${this.formatYAML(item, indent + 2).trim()}`);
        } else {
          lines.push(`${spaces}- ${item}`);
        }
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          lines.push(`${spaces}${key}:`);
          for (const item of value) {
            if (typeof item === "object" && item !== null) {
              lines.push(
                `${spaces}  - ${this.formatYAML(item, indent + 4).trim()}`,
              );
            } else {
              lines.push(`${spaces}  - ${item}`);
            }
          }
        } else if (typeof value === "object" && value !== null) {
          lines.push(`${spaces}${key}:`);
          lines.push(this.formatYAML(value, indent + 2));
        } else if (typeof value === "string" && value.includes("$")) {
          // Don't quote environment variables
          lines.push(`${spaces}${key}: ${value}`);
        } else if (typeof value === "string") {
          lines.push(`${spaces}${key}: '${value}'`);
        } else {
          lines.push(`${spaces}${key}: ${value}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate health check script for manual verification
   */
  public static generateHealthCheckScript(): string {
    return `#!/bin/bash
set -e

# Health check script for Witylogix deployment
# Usage: ./health-check.sh [api_url] [max_retries]

API_URL=\${1:-http://localhost:3000}
MAX_RETRIES=\${2:-30}
RETRY_DELAY=2

echo "Checking health of $API_URL..."

for ((i = 1; i <= MAX_RETRIES; i++)); do
  echo "Attempt $i/$MAX_RETRIES..."

  if curl -f "$API_URL/health" > /dev/null 2>&1; then
    echo "✓ API is healthy"

    # Check detailed health
    HEALTH=$(curl -s "$API_URL/health/detailed" | jq -r '.status')

    if [ "$HEALTH" = "healthy" ]; then
      echo "✓ All checks passed"
      exit 0
    else
      echo "⚠ Status: $HEALTH (may be degraded)"
      exit 0
    fi
  fi

  if [ $i -lt $MAX_RETRIES ]; then
    echo "✗ Health check failed, retrying in \${RETRY_DELAY}s..."
    sleep \$RETRY_DELAY
  fi
done

echo "✗ Health check failed after $MAX_RETRIES attempts"
exit 1
`;
  }
}

/**
 * Export helper functions
 */
export function generateDockerCompose(env: EnvironmentType): string {
  return DockerComposeGenerator.generateDockerCompose(env);
}

export function generateEnvTemplate(env: EnvironmentType): string {
  return DockerComposeGenerator.generateEnvTemplate(env);
}

export function generateNginxConfig(): string {
  return DockerComposeGenerator.generateNginxConfig();
}

export function generateHealthCheckScript(): string {
  return DockerComposeGenerator.generateHealthCheckScript();
}
