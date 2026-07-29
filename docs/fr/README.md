# Documentation du projet

Cette documentation décrit l’architecture réellement présente dans le dépôt.
Le projet est un monorepo pnpm TypeScript composé d’une application React, d’une
API Fastify et de packages consacrés au domaine IAM et à ses adaptateurs.

## Parcours de lecture

Pour une première prise en main, lire dans cet ordre :

1. [Vue d’ensemble](architecture/overview.md) — objectifs, frontières et flux ;
2. [Couches](architecture/layers.md) — responsabilité de chaque niveau ;
3. [Règles de dépendance](architecture/dependency-rules.md) — imports autorisés
   et interdits ;
4. [Packages](architecture/packages.md) — API publique et implémentations ;
5. [Installation](development/getting-started.md) ;
6. [Ajouter une fonctionnalité](development/adding-a-feature.md).

## Référence par besoin

### Architecture

- [Vue d’ensemble](architecture/overview.md)
- [Couches et frontières](architecture/layers.md)
- [Règles de dépendance](architecture/dependency-rules.md)
- [Packages et API publiques](architecture/packages.md)
- [Décisions architecturales](architecture/decisions/README.md)

### Développement

- [Installation et exécution](development/getting-started.md)
- [Conventions](development/conventions.md)
- [Tests et vérifications](development/testing.md)
- [Ajouter une fonctionnalité](development/adding-a-feature.md)

### Guides et références

- [Authentification et sessions](guides/iam-sessions.md)
- [Administration des utilisateurs](guides/iam-user-administration.md)
- [Politique de mot de passe](guides/password-policy.md)
- [Sécurité du compte, MFA, audit et configuration](guides/account-security.md)
- [Interface HTTP](reference/http-api.md)
- [Spécifications fonctionnelles](specifications/README.md)

## Sources de vérité

- Les exports d’un package sont définis par son `package.json` et ses fichiers
  d’index.
- Les contrats applicatifs sont dans
  `packages/iam/core/application/<capacité>/use-cases`.
- Les routes IAM historiques et leurs schémas HTTP sont dans
  `apps/api/src/features/iam`.
- Les parcours de récupération, MFA, audit, configuration, export et
  suppression sont dans `apps/api/src/security`; leurs routes ne possèdent pas
  encore de schémas TypeBox complets.
- Les commandes disponibles sont définies par les scripts des `package.json`.
- Swagger sur `/docs` est la référence exécutable des routes munies de schémas.
  Pour les routes de sécurité, consulter aussi la
  [référence HTTP](reference/http-api.md).

La documentation explique ces sources ; elle ne les remplace pas.
