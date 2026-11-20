#!/usr/bin/env bash
# Validate the actual built Web image and all configured Nginx HTTP log sinks.
set -Eeuo pipefail

image="$1"
network="http-log-canary-network-$$"
api="http-log-canary-api-$$"
web="http-log-canary-web-$$"
scratch="$(mktemp -d)"

cleanup() {
  docker rm -f "$web" "$api" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$scratch"
}
trap cleanup EXIT
diagnose_failure() {
  local exit_code="$?"
  printf 'Nginx smoke aborted at line %s, exit code %s\n' "${BASH_LINENO[0]}" "$exit_code" >&2
  docker inspect --format '{{.Name}} running={{.State.Running}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' "$api" "$web" >&2 || true
}
trap diagnose_failure ERR

echo "Nginx smoke: create isolated network and upstream"
docker network create "$network" >/dev/null

# Use the built image to host a deliberately minimal, non-logging mock upstream.
docker run --detach --name "$api" --network "$network" --network-alias api --entrypoint sh "$image" \
  -c 'printf "pid /tmp/mock-nginx.pid;\nerror_log /dev/null crit;\nevents {}\nhttp { access_log off; server { listen 3000; location = /api/health { return 204; } location /api/ { return 404; } } }\n" >/tmp/mock-nginx.conf; nginx -c /tmp/mock-nginx.conf; while :; do sleep 3600; done' \
  >/dev/null
docker run --detach --name "$web" --network "$network" \
  --publish 127.0.0.1::8080 "$image" >/dev/null

echo "Nginx smoke: validate config and output sinks"
docker exec "$web" nginx -t >"$scratch/config-test.stdout" 2>"$scratch/config-test.stderr"
docker exec "$web" sh -c \
  'test ! -e /tmp/nginx_access.log && test ! -e /tmp/nginx_error.log'

port="$(docker port "$web" 8080/tcp | head -n1 | awk -F: '{print $NF}')"
base="http://127.0.0.1:$port"
canary="SYNTHETIC_NGINX_CANARY_145"
for _ in $(seq 1 50); do
  if curl --silent --max-time 2 --connect-timeout 1 --output /dev/null "$base/"; then
    break
  fi
  sleep 0.2
done

probe_index=0
check() {
  probe_index=$((probe_index + 1))
  printf 'Nginx smoke: probe %s\n' "$probe_index"
  local expected="$1"
  local path="$2"
  local status
  if ! status="$(curl --silent --path-as-is --max-time 5 --connect-timeout 2 \
    --output /dev/null --write-out '%{http_code}' \
    --header "Authorization: Bearer $canary" \
    --header "Cookie: session=$canary" "$base$path" 2>"$scratch/curl.stderr")"; then
    printf "Nginx smoke: probe %s connection failed or timed out\n" "$probe_index" >&2
    return 1
  fi
  if [[ "$status" != "$expected" ]]; then
    printf 'Unexpected HTTP status: expected %s, got %s\n' "$expected" "$status" >&2
    exit 1
  fi
}

echo "Nginx smoke: exercise ordinary and upstream HTTP requests"
check 200 "/verify?token=$canary"
check 200 "/recovery?token=$canary"
check 200 "/cancel-deletion?token=$canary"
check 200 "/unknown/$canary?token=$canary"
check 204 "/api/health?token=$canary"
check 404 "/api/missing/$canary?token=$canary"
# Keep Docker DNS/IP live while terminating the upstream listener, to obtain
# deterministic ECONNREFUSED instead of waiting for dropped SYN packets.
docker exec "$api" sh -c 'kill -TERM "$(cat /tmp/mock-nginx.pid)"'
sleep 0.2
check 502 "/api/health?token=$canary"

echo "Nginx smoke: exercise malformed early-parser requests"
# Raw TCP deliberately reaches Nginx's early HTTP parser rather than curl's parser.
python3 - "$port" "$canary" <<'PY'
import socket
import sys

port = int(sys.argv[1])
token = sys.argv[2]
requests = [
    f"GET /broken-{token} HTTP/1.1\r\nHost: localhost\r\nBad Header\r\n\r\n",
    f"GET /{token}{'X' * 20000} HTTP/1.1\r\nHost: localhost\r\n\r\n",
    f"GET /test HTTP/1.1\r\nHost: localhost\r\nCookie: {token}{'X' * 20000}\r\n\r\n",
    f"{token} /verify?token={token} HTTP/1.1\r\nHost: localhost\r\n\r\n",
]
for request in requests:
    with socket.create_connection(("127.0.0.1", port), timeout=3) as connection:
        connection.sendall(request.encode("ascii"))
        try:
            connection.recv(4096)
        except (ConnectionResetError, TimeoutError):
            pass
PY

echo "Nginx smoke: inspect all Nginx log sinks"
sleep 1
docker logs "$web" >"$scratch/stdout" 2>"$scratch/stderr"
for sink in "$scratch/stdout" "$scratch/stderr" \
  "$scratch/config-test.stdout" "$scratch/config-test.stderr"; do
  if grep --fixed-strings --quiet "$canary" "$sink"; then
    echo "FAIL: synthetic credential reached an Nginx output sink" >&2
    exit 1
  fi
done

python3 - "$scratch/stdout" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf8") as stream:
    records = [json.loads(line) for line in stream if line.lstrip().startswith("{")]
required = {
    "time", "request_id", "group", "method", "status", "duration",
    "upstream_status", "upstream_connect_time", "upstream_response_time",
}
assert len(records) >= 7, "Missing access diagnostics"
assert all(set(record) == required for record in records), "Unexpected access field"
assert all(record["group"] in {"api", "web"} for record in records)
assert all(record["method"] in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "OTHER"} for record in records)
assert {"204", "404", "502"}.issubset({record["status"] for record in records})
assert all(record["request_id"] and record["duration"] for record in records)
assert any(record["group"] == "api" and record["upstream_status"] == "502" for record in records)
PY
echo "PASS: Nginx access/error logs contain no synthetic credential"
