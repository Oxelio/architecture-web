# Agent-aware GitHub delivery — Documentation Validation

> **Content status:** Working validation evidence  
> **Authority:** Non-canonical evidence record  
> **Work:** Establish agent-aware GitHub delivery governance  
> **Work Type:** Governance Change  
> **Workflow Depth:** Complex  
> **Activity:** Validation  
> **Validated canonical patch:** `docs/project/delivery-pipeline.md` blob `a38ec79465307cad8c9030571e9b68678ff8c61e`

## 1. Validation scope

This validation is intentionally limited to the documentation/governance implementation. It does not claim that downstream GitHub labels, Project fields, execution claims, checks, environments, credentials, publisher mechanisms, or runtime adapters are activated.

Project validation policy requires proportional documentation evidence: relative links/referenced paths, formatting, and `git diff --check`.

## 2. Evidence

### Relative links / referenced paths

**PASS**

The canonical patch adds no new Markdown link target and removes none. The link set in `docs/project/delivery-pipeline.md` is unchanged from the current base document (11 relative links before and after), so the patch introduces no new unresolved relative path.

### Diff whitespace validation

**PASS**

A Git repository containing the base and patched `delivery-pipeline.md` was used to execute:

```text
git diff --check
```

Result:

```text
exit 0
```

No whitespace error was reported.

### Formatter / `format:check`

**NOT YET ESTABLISHED**

The execution environment used for this validation does not contain the repository's `pnpm` workspace or an installed Prettier binary. An isolated `npx` attempt could not retrieve Prettier within the available execution environment.

The repository declares `prettier ^3.9.6` and `pnpm format:check`, but this evidence has not been executed against the branch checkout here.

This missing evidence is not silently treated as a pass.

### Repository CI/status evidence

**NONE AVAILABLE**

No commit status/check was attached to canonical integration commit `e8479bf4f04caab2937d42b4a73cb1eb197b3250` when inspected.

## 3. Validation result

```text
VALIDATION INCOMPLETE
```

The governance implementation has passed Governance Compliance Review, relative-link impact review, and `git diff --check`, but the project-declared formatter evidence remains outstanding.

The Work therefore remains in `Validating` and MUST NOT enter `Done` on the basis of this record.

## 4. Required completion evidence

Before final validation acceptance, execute the repository formatter check against an actual branch checkout, normally:

```text
pnpm format:check
```

or an equivalent Prettier check using the repository-selected formatter version/configuration.

If the formatter changes the canonical patch, re-run Governance Compliance Review as needed when the resulting semantic diff is not purely formatting.
