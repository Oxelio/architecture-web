# Work #215 delegated authorization feasibility

This disposable experiment drives real OAuth requests through
`oidc-provider@9.15.1` and PostgreSQL. The
[proposed Technical Design](../../../docs/technical-designs/TD-DELEGATED-AUTHORIZATION-001.md#executable-feasibility-evidence)
owns the outcome and caveats. The
[approved Functional Specification](../../../docs/specifications/SF-DELEGATED-AUTHORIZATION-001.md)
owns product behavior.

## Run locally

Tested prerequisites are Node.js `24.15.0`, `26.8.1` or `26.13.1`, npm `11.19.1`, and Docker
with Linux containers. The lockfile pins `oidc-provider@9.15.1`,
`pg@8.16.3` and their full dependency trees. The experiment is outside pnpm
workspace discovery. Commands below run in PowerShell from the repository root.

```powershell
Set-Location scripts/spikes/delegated-authorization
npm ci --ignore-scripts --no-audit --no-fund
$spikeImage = 'postgres:18.6@sha256:e3d24f6906d0760bf4da0dae872415391ededefad23fd471c47dc53b0ddf3c42'
$spikeContainer = 'architecture-web-215-' + [guid]::NewGuid().ToString('N')
docker run --rm -d --name $spikeContainer --health-cmd 'pg_isready -h 127.0.0.1 -U spike -d spike' --health-interval 1s --health-timeout 3s --health-retries 20 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=spike -e POSTGRES_DB=spike -p 127.0.0.1::5432 $spikeImage
if ($LASTEXITCODE -ne 0) { throw 'Could not start the spike database' }

try {
  $spikeDeadline = (Get-Date).AddSeconds(30)
  do {
    $spikeHealth = docker inspect --format '{{.State.Health.Status}}' $spikeContainer
    if ($spikeHealth -eq 'healthy') { break }
    if ($spikeHealth -eq 'unhealthy' -or (Get-Date) -ge $spikeDeadline) {
      throw 'The spike database did not become ready'
    }
    Start-Sleep -Milliseconds 500
  } while ($true)

  $spikeAddress = docker port $spikeContainer 5432/tcp
  $env:SPIKE_DATABASE_URL = 'postgresql://spike@' + $spikeAddress + '/spike'
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Feasibility tests failed' }
} finally {
  Remove-Item Env:SPIKE_DATABASE_URL -ErrorAction SilentlyContinue
  docker stop $spikeContainer | Out-Null
}
```

To compare the repository pin and both LTS builds on the same fixture, run the
following in place of `npm test` with the database variable still set.

```powershell
npm exec --yes --package=node@24.15.0 -- node --test feasibility.test.mjs
npm exec --yes --package=node@26.8.1 -- node --test feasibility.test.mjs
npm exec --yes --package=node@26.13.1 -- node --test feasibility.test.mjs
```

Each test creates and drops a dedicated PostgreSQL schema. Issuer processes
listen on ephemeral loopback ports. The browser harness maps the fixed
logical issuer origin to the currently selected loopback process and inspects
the synthetic client redirect without visiting it. The test runner generates
signing and adapter keys per fixture and shares them with that fixture's
processes. The harness expects the synthetic `spike` role and database on
loopback. The default `npm test` runs both F06 models and the F02
control, for 12 tests covering F01–F10.

## Files and scope

- [`database.mjs`](database.mjs) holds the experimental IAM decisions, DDL and
  transaction fence.
- [`adapter.mjs`](adapter.mjs) persists provider artifacts and applies the
  frozen family entitlements during provider lookups and writes.
- [`issuer.mjs`](issuer.mjs) wires the provider, custom interactions and the
  mock resource admission endpoint.
- [`feasibility.test.mjs`](feasibility.test.mjs) drives HTTP, coordinates independent
  issuer processes, injects PostgreSQL failures and checks persisted effects.

The harness uses loopback HTTP, static synthetic client metadata, an existing
synthetic first-party session, one resource and two permissions. The resource
route is an in-process admission stand-in. See the Technical Design for the
remaining Fastify, IAM, operational and privacy questions.
