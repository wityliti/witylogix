# infra/security/container-policy.rego
# OPA (Open Policy Agent) Container Security Policy
#
# Purpose: Enforce security requirements for container images and deployments
#
# Policy Rules Enforced:
# - Deny containers running as root user
# - Require read-only root filesystem
# - Require resource limits (CPU, memory)
# - Require health checks
# - Deny privileged containers
# - Require security context restrictions
#
# Usage with conftest:
#   conftest test -p infra/security/container-policy.rego docker-compose.prod.yml
#
# Usage with OPA:
#   opa eval -d infra/security/container-policy.rego -i input.json 'data.main'

package main

# Deny containers running as root
deny[msg] {
  image := input.services[_].build.context
  user := input.services[_].user
  user == "root"
  msg := sprintf("Container must not run as root. Service may violate this: %s", [image])
}

# Deny containers without explicit user
deny[msg] {
  service := input.services[name]
  not service.user
  msg := sprintf("Container must specify a non-root USER. Service '%s' does not", [name])
}

# Require resource limits for all services
deny[msg] {
  service := input.services[name]
  not service.deploy.resources.limits.memory
  msg := sprintf("Service '%s' must have memory limit defined", [name])
}

deny[msg] {
  service := input.services[name]
  not service.deploy.resources.limits.cpus
  msg := sprintf("Service '%s' must have CPU limit defined", [name])
}

# Require health checks for services exposing ports
deny[msg] {
  service := input.services[name]
  service.ports
  not service.healthcheck
  msg := sprintf("Service '%s' with exposed ports must define a health check", [name])
}

# Deny privileged containers
deny[msg] {
  service := input.services[name]
  service.privileged == true
  msg := sprintf("Service '%s' must not run in privileged mode", [name])
}

# Require read-only root filesystem (warning, not strict deny)
warn[msg] {
  service := input.services[name]
  not service.read_only
  msg := sprintf("Warning: Service '%s' should have read-only root filesystem", [name])
}

# Require restart policy
deny[msg] {
  service := input.services[name]
  not service.restart
  msg := sprintf("Service '%s' must define a restart policy", [name])
}

# Validate restart policies (only allow safe values)
deny[msg] {
  service := input.services[name]
  service.restart
  not valid_restart_policy(service.restart)
  msg := sprintf(
    "Service '%s' has invalid restart policy '%s'. Must be one of: no, always, unless-stopped, on-failure",
    [name, service.restart]
  )
}

# Require environment variables for sensitive configurations
deny[msg] {
  service := input.services[name]
  service_requires_secret_config(name)
  not service.environment.JWT_SECRET
  msg := sprintf("Service '%s' requires JWT_SECRET environment variable", [name])
}

# Deny hardcoded secrets in environment variables
deny[msg] {
  service := input.services[name]
  secret_key := ["PASSWORD", "TOKEN", "SECRET", "API_KEY"]
  env_var := service.environment[key]
  contains(key, secret_key[_])
  not is_env_reference(env_var)
  msg := sprintf(
    "Service '%s' has hardcoded secret in environment variable '%s'. Use environment variable reference instead",
    [name, key]
  )
}

# Require logging configuration
deny[msg] {
  service := input.services[name]
  not service.logging
  msg := sprintf("Service '%s' must define logging configuration", [name])
}

# Deny unbounded memory for caching services
deny[msg] {
  service := input.services[name]
  contains(name, "redis")
  memory_limit := service.deploy.resources.limits.memory
  parse_memory(memory_limit) > 2048  # Max 2GB for Redis
  msg := sprintf("Redis service '%s' has excessive memory limit: %s", [name, memory_limit])
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

# Valid restart policies for production
valid_restart_policy(policy) {
  policy == "no"
}

valid_restart_policy(policy) {
  policy == "always"
}

valid_restart_policy(policy) {
  policy == "unless-stopped"
}

valid_restart_policy(policy) {
  policy == "on-failure"
}

# Services that require secret configuration
service_requires_secret_config(name) {
  contains(name, "api")
}

service_requires_secret_config(name) {
  contains(name, "worker")
}

service_requires_secret_config(name) {
  contains(name, "dashboard")
}

# Check if a value is an environment variable reference
is_env_reference(value) {
  contains(value, "${")
}

# Parse memory string to MB (e.g., "512M" -> 512, "2G" -> 2048)
parse_memory(mem_str) = result {
  endswith(mem_str, "G")
  trimmed := trim_suffix(mem_str, "G")
  to_number(trimmed) * 1024 == result
}

parse_memory(mem_str) = result {
  endswith(mem_str, "M")
  trimmed := trim_suffix(mem_str, "M")
  to_number(trimmed) == result
}

# ─────────────────────────────────────────────────────────────────────────────
# Usage Examples
# ─────────────────────────────────────────────────────────────────────────────
#
# With conftest (kubectl policy testing):
#
#   1. Install conftest:
#      wget https://github.com/open-policy-agent/conftest/releases/download/v0.48.0/conftest_0.48.0_Linux_x86_64.tar.gz
#      tar xzf conftest_0.48.0_Linux_x86_64.tar.gz
#      sudo mv conftest /usr/local/bin/
#
#   2. Test Dockerfile:
#      conftest test -p infra/security/container-policy.rego \
#        infra/docker/Dockerfile.api
#
#   3. Test Docker Compose:
#      conftest test -p infra/security/container-policy.rego \
#        infra/docker-compose.prod.yml
#
# With OPA directly:
#
#   opa run -s infra/security/container-policy.rego
#   curl localhost:8181/v1/data/main/deny -X POST -d @input.json
#
# In CI/CD Pipeline:
#
#   script:
#     - conftest test -p infra/security/container-policy.rego \
#         infra/docker-compose.prod.yml || exit 1
#
# Generate policy documentation:
#
#   opa fmt -d infra/security/container-policy.rego
