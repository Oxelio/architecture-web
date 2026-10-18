# Context Manifest — Work #49 architecture proposal

- **Artifact status:** Working context; non-normative; supports the Work #49 Technical Design
- **Context status:** PARTIALLY RESOLVED for design comparison. Sufficient to produce a conditional Proposed design; not sufficient to establish implementation readiness.
- **Role:** Architecture Analyst / Technical Designer (Method Software Architect authority).
- **Activity:** Architecture alternatives and Technical Design proposal, stopped before implementation.
- **Work State:** Unavailable; live Project #3 access returned `Resource not accessible by integration`.
**Recommended classification:** Defect Correction / Complex, with security/privacy, breaking compatibility, cross-system, concurrency and operational/data migration characteristics. Live classification not readable; this is not an owner-field replacement.

## Source identity and drift

Architecture Web `development`: `a3d09eafe7caafe6542c6832a67cc6f26f219de1`. Remote HEAD rechecked after drafting and unchanged. Input source extracted from that immutable commit to `/tmp/aw49-source`; working checkout `/workspace/Architecture-Web` remains untouched. Adopted Method gitlink: `703051af50189a70399d82c82ca0f2b17c35f998`, read from an archive at that exact revision in `/tmp/aw49-method`. Issue #49 and #44 comments are evidence, not substitute specifications or approval of this proposal.

## Authoritative context

- `AGENTS.md`, Project Method Profile and Delivery profile: repository/operational ownership and role/gate boundaries.
- Adopted Method README, core model, classification, lifecycle, artifact ownership, roles, Context Manifest, Readiness, Review/Validation: generic governance at the adopted revision.
- `docs/project/architecture-principles.md`, architecture overview, dependency rules, packages, ADR register and ADR-0004/5/6/7: structural constraints/current-state claims and rationale. Register contains ADR-0001/2/3.
- SF-SESSION-001 (`Implementation` legacy maturity), SF-SECURITY-AUDIT-001 and SF-ACCOUNT-DATA-001 (`Approved`): behavior/confidentiality owners. Catalog explains legacy status.
- `docs/development/testing.md`: evidence boundaries, project commands and human-supplied candidate-bound validation.
- Project Technical Design template: proposal structure adapted to the requested Method output.

## Required working context

- User's read-only architecture scope and stop before implementation.
- Work #49 objective; #44 conclusion/human decision record, especially no broad IAM rewrite.
- This proposal and comparison are working context only until accepted and integrated into proper owners.

## Relevant evidence

Password and MFA creation; cookie authentication; SessionEntity/SessionRepository; Redis records/scripts/tests; own/admin listing and revocation; public sign-out; recent-password callers; integration mapper/outbox; Audit write/query/export mapping; Notifications static content; ZIP generation; HTTP Audit/logging; current web warnings and ID usage. Exact files and hashes follow.

## Conditional context

- Activated: security/privacy, migration, compatibility, concurrency and performance risks; relevant ADRs; event-consumer/export paths; live Project read (failed).
- Deployment data, SLOs, real Redis/PostgreSQL integration results, incident/exposure inventory: not supplied or accessed. Required to authorize and validate rollout, not to compare proposed structures.
- SF-NOTIFICATIONS-001 becomes a required functional review owner if adding a missing MFA notification enters scope; no such change is authorized here.

## Excluded by default

General IAM rewrite, full SecurityService extraction, new authenticators, stateless/JWT conversion, config redesign, unrelated stale-write/recovery defects, full repository security audit, implementation/Tasks/PRs and all GitHub mutations.

## Missing/conflicting context

- Live Project state/classification unavailable despite verified repository activation record: non-blocking for proposal; no inferred state or transition.
- Historical no-production statement is not a current deployment inventory. Session invalidation, legacy replay and unsafe-archive policy need operator and functional-owner decisions.
- Append-only Audit and physical secret cleanup can conflict; legal holds and historical retention are unknown. Read redaction does not erase stored copies.
- Guide claims active-only resolution, but code rejects only suspended users. Guide claims hard-coded lifetime, but creation reads policy. Overview lists three aggregates, ADR-0006/code five. Route to owning current-architecture/functional correction; do not silently reconcile.
- No runtime PoC, application tests or performance benchmarks executed in this design-only activity. Redis/ZIP tests inspected are limited and do not prove end-to-end behavior.
- The optional hardening skill's shared `artifact-storage.md` reference was not exposed by its readable skill package. Its proposal-format reference was read. Outputs follow the user's stricter boundary: outside source/canonical documentation; no scan artifacts exist or were modified. Main artifact follows the project Technical Design template rather than creating competing canonical documentation.

## Evidence inventory

Collection SHA-256: `96dd49b2bf530462abfb5202c4a21951aa92ebd86f259f1604dc42451fa70e56`. The digest binds the following ordered records (canonical compact JSON, sorted keys), not an alleged scan seal. Artifacts: 86.

| Input class | Path | SHA-256 |
| --- | --- | --- |
| repository | `AGENTS.md` | `9fec4ec0db9407278a5ad6b0f0c144a2dcf838ae48b4a7e6198de28652f298d3` |
| repository | `.github/delivery-automation.json` | `f807b80a288857547e9e4f88090ce1ddf5937c25e8eca5b5138041da47c49bfc` |
| repository | `docs/project/project-method-profile.md` | `76c7069e3d2ff9529305524b9233eebedf4851b4039096cd98a2426622dff6ff` |
| repository | `docs/project/delivery-pipeline.md` | `57d2d61f145f5a1274c6709a03d6f23693946370977b2ad3fe2ac97696787e51` |
| repository | `docs/project/architecture-principles.md` | `1bfa82a67ca4f10df05799c91d9359a09b90a82a3719c23b1fef3738dd6dc0ab` |
| repository | `docs/project/templates/technical-design.md` | `6e19f9624390f04088d0e80a6cb338cf2a0868718f0f05ecaaf85a1d15143af9` |
| repository | `docs/architecture/overview.md` | `ef0f4d9bf419cf502f57856eb73815b6c695ca41bad757d845943c52c5005cda` |
| repository | `docs/architecture/dependency-rules.md` | `ee11066dcb8dcaaad1f03a3d97335ef416e1228fd998b1710c2d238cbc51b349` |
| repository | `docs/architecture/packages.md` | `950077b13b052afa523c48ae7741fedbd0178773468ae350c47c694356de8115` |
| repository | `docs/architecture/decisions/README.md` | `144d1eb510c8c368843ef47b07987c1257fe40cbc47d9cf4d1af6190681b4638` |
| repository | `docs/architecture/decisions/0004-aggregates-and-consistency.md` | `e85f058f0fd8bbe3e858b9b553fc5b09e7b8524bf5daf9e408a4878569047155` |
| repository | `docs/architecture/decisions/0005-domain-events-messaging.md` | `8180f075ba8ed9da864079dfa4f80ec8a299233f710470a165dfc081e5af55b2` |
| repository | `docs/architecture/decisions/0006-iam-account-identities-and-authenticators.md` | `028d506237411b2e5ea007118e43b904edab1bdd81deff3001cc7afb71f1123f` |
| repository | `docs/architecture/decisions/0007-package-first-workspace-topology.md` | `a92d30d46d7d324496b9cc68bd1b85ccb0ddcb5ea469a69ba5a7e1f19e4a06c3` |
| repository | `docs/specifications/README.md` | `6d5bf4e57063711053bce81b6e8aa873c25e33e84f758fc43f63dfad0b0dd04b` |
| repository | `docs/specifications/SF-SESSION-001.md` | `21dcd15421567693c2e3389ffb25ad87667c2841e58b0cc6569ad5b5a31285e4` |
| repository | `docs/specifications/SF-SECURITY-AUDIT-001.md` | `8086b2141d77c9131a3dd070392a5a10309c225a86aaa6bcb3e839544bb6f6eb` |
| repository | `docs/specifications/SF-ACCOUNT-DATA-001.md` | `bb7a663b2f03ac9a298a942134b126f8a8dedf03d3cb6e671599c6b3222cb04b` |
| repository | `docs/development/testing.md` | `602a3a6fd76e081c79de1fc324b8a5e7b8b00784b4b4cca3d179218d7a3a28c7` |
| repository | `docs/guides/iam-sessions.md` | `b941f57dcf5e46769947839771dca7e5d1389dc7c01ff2bf00c50023506a6233` |
| repository | `packages/iam/src/domain/entities/session.entity.ts` | `c89874162e4f7f322d929064edafc6faaffbb841d37d90d8bc275b976254ac6a` |
| repository | `packages/iam/src/domain/value-objects/session-identifier.value-object.ts` | `c6a216ff46420d8b548471243e9d3496fd2f6c8a61cbc0074c8cb3b9bcffb159` |
| repository | `packages/iam/src/domain/events/iam-domain-events.ts` | `5e93e8b8de4368976885381a95751dcd73dc959d537ffaac4e6969f8a623607a` |
| repository | `packages/iam/src/application/repositories/session.repository.ts` | `4de9a094c54ced8c86168296c2f9a6a00d16e067c2fc313a9dd9887cf1d93a98` |
| repository | `packages/iam/src/application/create-iam.ts` | `52244a97742ba7b5f7707fce49b392a4d494f41e35b8562fb8304682dbd9a1f4` |
| repository | `packages/iam/src/application/events/iam-integration-event.ts` | `7a13254736507fb74bf5a4fc6c8bd3907ce4a95fb0aaae5793e06514dd309dcf` |
| repository | `packages/iam/src/application/authentication/sign-in/sign-in.use-case.ts` | `6c12c38734df89412416f44c3b09411d2acb370797647d1cece24f7609f813ae` |
| repository | `packages/iam/src/application/authentication/sign-in/sign-in.contracts.ts` | `714ba47d296fabb85aee886ced5f3e5dc51726f8810c10736dc4114567764c68` |
| repository | `packages/iam/src/application/authentication/sign-in/sign-in.use-case.spec.ts` | `5e83b5bd79f825b1e64279c65c7b644a00238afc3c3e61465e06ddd42a69f01f` |
| repository | `packages/iam/src/application/authentication/resolve-session/resolve-session.use-case.ts` | `9982a05639cde0fcf5c65358c50624fecf475b0ab7e9a2855785bc0c58848c07` |
| repository | `packages/iam/src/application/authentication/resolve-session/resolve-session.contracts.ts` | `709aa8e4b76cbb4bea23af7cb5b803add3f3ea37f6b1a65a93ac80d4e9f1fa74` |
| repository | `packages/iam/src/application/authentication/resolve-session/resolve-session.use-case.spec.ts` | `769c08e5d9bbd0ccdbe1bd16ae7d93362d019a9e1de56f6238e1b45f37b02acc` |
| repository | `packages/iam/src/application/authentication/sign-out/sign-out.use-case.ts` | `8ac45c5fc5090879386b2432c82bb1471faf67ecbd3144a887b086ddea74e886` |
| repository | `packages/iam/src/application/authentication/sign-out/sign-out.use-case.spec.ts` | `41a02f65c57c52b979523da8b913cede6a4ce07c2149103257be733eda7a29fb` |
| repository | `packages/iam/src/application/authentication/list-current-user-sessions/list-current-user-sessions.use-case.ts` | `c9ff0ba8399951c109b2ee587a63163b5c0db0d03c71e0dc05eb339e1f5b8fda` |
| repository | `packages/iam/src/application/authentication/list-current-user-sessions/list-current-user-sessions.contracts.ts` | `c6dc4f237d825296d01b20eacb2b75965e4cbb7662c30e9d7d4d523660579090` |
| repository | `packages/iam/src/application/authentication/list-current-user-sessions/list-current-user-sessions.use-case.spec.ts` | `bdefdd1ab491b48df36ee2fbd47a5b6eca1e880b7f1c85afc3dae3aa1108a4a2` |
| repository | `packages/iam/src/application/authentication/revoke-current-user-session/revoke-current-user-session.use-case.ts` | `afb991fe4d931caf15b03c5a453b25be41e1cc8125254ef8c9e37164d6c753d2` |
| repository | `packages/iam/src/application/authentication/revoke-current-user-session/revoke-current-user-session.use-case.spec.ts` | `819ae0e0712db86a4992db8fdd48f3f22e2ac087cfa4c21da1fc467ea4b5f800` |
| repository | `packages/iam/src/application/access-administration/list-user-sessions/list-user-sessions.use-case.ts` | `cac9c95ac1eb1ebcbf08483fd8ec9ca92d92132ac415dc5e87631e4a3b251256` |
| repository | `packages/iam/src/application/access-administration/list-user-sessions/list-user-sessions.contracts.ts` | `4918b73507cd9f62bc220c9d0d433e7530b1e4593de1802cbb4802cf1daef764` |
| repository | `packages/iam/src/application/access-administration/revoke-user-session/revoke-user-session.use-case.ts` | `623906c1dbb53e078626fefe43a5fc02d980b63bf979f7a6ae79700e2ca5cc71` |
| repository | `packages/iam/src/application/services/administrator-authorizer.service.ts` | `7af474da5aeaa5db24d4c9adb15ba64bb98a53fddc142a5e809d2a78928ca082` |
| repository | `packages/iam-session-redis/src/adapters/redis-session.adapter.ts` | `400c0554e67124c270b3c83f70092665839cdcaa1729140a157ea4764838fd0f` |
| repository | `packages/iam-session-redis/src/adapters/redis-session.adapter.spec.ts` | `c68d1b73b824afaa074cc8091fc7878b9b96d6b2a66bbcde33e96ccffc75a819` |
| repository | `apps/api/src/auth.ts` | `4fb14c8a54b675308d7ea37eaefe99cbd0b84aba33dd3a4a8f552de68c92052a` |
| repository | `apps/api/src/server.ts` | `0414d0ad8aa0c9e0e5ef192d6f9dee5f9bcd2afd0b95862a4391e7dcade708a3` |
| repository | `apps/api/src/types/error-handler.ts` | `fbd6f1859b704c9345e9352c8062fb858e8bea567b64e92f84e7ed064f9c6cd6` |
| repository | `apps/api/src/composition-root/application.module.ts` | `b4f32be568cd61b11f66f988dec9e80b9c42bd7241abbf25570fa0673f38e656` |
| repository | `apps/api/src/composition-root/iam.module.ts` | `1f5f4cc61ed1d5ef302826daedd2324386d9ae7848094decba009c748ec9bcbe` |
| repository | `apps/api/src/features/iam/routes/public.routes.ts` | `822a1b1c2c49f809ef39362accfa44349c7bc4358946652bdb38622dde4f37b8` |
| repository | `apps/api/src/features/iam/sign-in/sign-in.controller.ts` | `4354c4685f796c9cb9a90babed69f6cccb9922d90fc7438875730bffc65c4741` |
| repository | `apps/api/src/features/iam/sign-in/sign-in.presenter.ts` | `41455ab83b30bea09ebcc020d8a9e57c70d917ca4411b175a2296689fd87d989` |
| repository | `apps/api/src/features/iam/sign-in/sign-in.http.ts` | `10729d33b3b468602d28b421206651e802ab5f2f854ceac86ae6ccd4552f5c66` |
| repository | `apps/api/src/features/iam/sign-out/sign-out.controller.ts` | `446449ccdd4193ae966e1ed36f445b6a5d2ab2e7d3fc8fa442c86ec20370423f` |
| repository | `apps/api/src/features/iam/sign-out/sign-out.http.ts` | `8ce31ac441c1319d9f53f16711e5bc6cf98ed33ba7bd9e41d635449febf1eaf0` |
| repository | `apps/api/src/features/iam/revoke-user-session/revoke-current-user-session.controller.ts` | `7593d40932f72f82b36ed2a2cacff710e43049223bd1a39a273c11ce66951095` |
| repository | `apps/api/src/features/iam/revoke-user-session/revoke-user-session.http.ts` | `1abecb28f7822e83fdd9a8ed83b67bd10c63e448ea76f028879fc0c55bb83949` |
| repository | `apps/api/src/security/security.service.ts` | `c84e4478fa8a91b05441d2cf67d95cd02abb9707c4483b5149f6bdec16633ced` |
| repository | `apps/api/src/security/security.routes.ts` | `2ce69fa7ff10dba305101ac0a4ecb53d329da8031cc49d8e2761084e666cf69d` |
| repository | `apps/api/src/security/security.service.spec.ts` | `67de39215dfcc6532988b0d175a02099819c209c41d5bc9e7ba3580dd4665bfa` |
| repository | `packages/messaging-persistence-kysely/src/kysely-outbox.adapter.ts` | `9cf1d2c547f0f6f50f19f8e8ea2a15df394404475fa803eb1e5d33c550eaaf49` |
| repository | `packages/audit/src/application/events/audit-integration-event.handler.ts` | `5287932ef5f899e090d417b93f1911b045c9e60c9de1cc64f10d1cd94bd0da1e` |
| repository | `packages/audit/src/application/events/audit-integration-event.handler.spec.ts` | `e04cc0964c3fce864480d1231fdcfa3e424f20313fbad3a2ceb7c83ae20ddc39` |
| repository | `packages/audit/src/application/services/audit.application.ts` | `757075bdd72d2c4728154c19cb1a35bc3e511532d743a0556d69e61406116830` |
| repository | `packages/audit/src/domain/audit-redaction.policy.ts` | `446bc0940cfec303dad43146d384645fa39b75a098a23c552289ff771c86a12c` |
| repository | `packages/audit-persistence-kysely/src/audit-entry.mapper.ts` | `1ba9d4d343796343a749182c4d114c9fbdf7d7ee265786728f71577882934cce` |
| repository | `packages/audit-persistence-kysely/src/kysely-audit.repository.adapter.ts` | `7fe402afa0fc02f6d79035cf9a02a7106a9dd5028533a2c903538e5f1e927d91` |
| repository | `packages/notifications/src/application/use-cases/notification-event-handler.use-case.ts` | `a514467f6c2f19864bc47ff355c7ab09a43754eecd70826e67ef52fb39c352d0` |
| repository | `packages/notifications/src/application/policies/notification.policies.ts` | `8efe295c28635262814cdd2bf09aa2eb87e18acd0907973b19455743d54d2413` |
| repository | `apps/web/src/components/SessionSummary.tsx` | `5f427604393f58e4613b408d616904294ba93d794ab788e1781f4d03e3c5ca95` |
| repository | `apps/web/src/pages/ProfilePage.tsx` | `5656823d7e46acd9f312d0948561c1afbcd29a327e83ac4c506e2cb171452880` |
| repository | `apps/web/src/pages/AdminPage.tsx` | `30886f458c551d775b7de6aca073a3037ce7adbb216c6b861175495fd78ce577` |
| repository | `apps/web/src/services/api.ts` | `45293c28354c44466e6c963172b01bd973855fe39a67855e075ce8c0834eb384` |
| repository | `docker-compose.yml` | `3f366a8bcab03bb8fd7f2f2ecb7e1a44eea66d8fbecd516bb48abcca3ef106af` |
| adopted-method | `README.md` | `5021ebcedc65a80582610f54341168e626793a010637adaf0bc77357a8e11689` |
| adopted-method | `core-model.md` | `5869753d54c3297896e713ae89ed3b413ed5b5ac1c13ac5156fad5295a9a652c` |
| adopted-method | `work-classification.md` | `42e4023babdfbe9c6458f35f1089a2ef2ba921488dafb3510ad9d4f48fdacc79` |
| adopted-method | `lifecycle.md` | `ef3e36afae30fd7845960a140bef717e754265313bd6eed4d8f4790af340a2e5` |
| adopted-method | `artifact-ownership.md` | `90b6276a301eb1f44d0091dd74b3796d7c56f53e8572649d1380bb4e7d9b576f` |
| adopted-method | `roles.md` | `780c299a051211ea1403c5ebd6776403075cbbf5fc5d3f8bf99732eb4d61e10b` |
| adopted-method | `context-manifest.md` | `7b6b493efed1e4d8228ae48629d1c8537d663cfa4a869f0c568a09d7da0caace` |
| adopted-method | `readiness-review.md` | `983a61d7c554ca2a4ecae028fb1231102cdc5cba322aea92e6886e088cbf4a58` |
| adopted-method | `review-validation.md` | `a6ba3eeb79826828740567383ad1ff9341e2ea9c2ddebd8bcf3554090311b450` |
| github-operational-evidence | `issue-44-comments.json` | `96e3a8b3db8dfb2d0ef94a8457e77338085e4fb060499436faed4fc53345e258` |
| github-operational-evidence | `issue-49.json` | `dccf465f888bd6e700aa101bdf5a78c4ced0aea71ae4fa222cb5f4bed1c56759` |