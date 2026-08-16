# Template — Validation Report

Use a report for significant changes where durable evidence is useful. Small
changes can rely directly on automated test and pull-request evidence.

```markdown
# Validation — <feature / change>

**Lifecycle:** Validation
**Content status:** Historical Record
**Document type:** Validation Report
**Domain:** <bounded context / project area>

## Subject

...

## Acceptance criteria / risks being validated

...

## Evidence

### Unit / domain / application tests

...

### Adapter / integration / contract tests

...

### End-to-end / acceptance tests

...

### Security / migration / performance checks

...

### Manual validation

...

## Deviations and failures

...

## Conclusion

<Done | Return to Implementation | Return to Technical Design | Return to Design>

## Documents to synchronize

...
```
