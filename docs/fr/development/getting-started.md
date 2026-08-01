# Installation et exécution

## Prérequis

- Node.js compatible avec TypeScript 5.9 et Vite 8 ;
- pnpm `11.15.1`, version déclarée à la racine ;
- Docker Compose pour PostgreSQL, Redis et Mailpit, ou des services équivalents.

Le dépôt ne déclare pas de version Node exacte. Vérifier la compatibilité de
l’environnement local avec les moteurs des dépendances avant de standardiser
une version dans la documentation ou la CI.

## Installer

Depuis la racine :

```bash
pnpm install
```

## Configurer l’API

Copier `apps/api/.env.example` vers `apps/api/.env`, puis adapter les valeurs.
La configuration est validée au démarrage par Zod dans
`apps/api/src/config/app.config.ts`.

Variables requises :

- PostgreSQL : `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`,
  `DATABASE_USER`, `DATABASE_PASSWORD` ;
- Redis : `REDIS_HOST`, `REDIS_PORT` ;
- SMTP : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
  `SMTP_FROM_ADDRESS`, `SMTP_VERIFY_URL`, `SMTP_RECOVERY_URL`,
  `SMTP_DELETION_CANCELLATION_URL` ;
- sécurité : `SECURITY_ENCRYPTION_KEY`, clé aléatoire d’au moins 32 caractères
  utilisée pour chiffrer les secrets TOTP au repos.

Les variables facultatives `NOTIFICATIONS_SLACK_WEBHOOK_URL` et
`NOTIFICATIONS_SMS_WEBHOOK_URL` activent les adaptateurs de notification
correspondants.

`COOKIE_SECURE` et `TRUST_PROXY` ajustent la sécurité du cookie et la confiance
accordée au proxy. `SMTP_VERIFY_URL` est l’URL complète de la page web qui
reçoit le jeton. `WEB_ORIGIN` figure dans l’exemple et dans Docker Compose,
mais la configuration Fastify actuelle utilise `origin: true` et ne le lit pas.
La rotation de `SECURITY_ENCRYPTION_KEY` exige une migration contrôlée des
secrets MFA existants.

## Démarrer les services

Pour l’environnement complet :

```bash
docker compose up --build
```

Services par défaut :

- web : `http://localhost:5173` ;
- API : `http://localhost:3000` ;
- Swagger UI : `http://localhost:3000/docs` ;
- Mailpit : `http://localhost:8025` ;
- PostgreSQL : port `5432` ;
- Redis : port `6379`.

Pour développer les applications localement tout en gardant les dépendances
dans Docker :

```bash
docker compose up postgres redis mailpit
pnpm migrate:up
pnpm dev:api
pnpm dev:web
```

Exécuter les deux commandes `dev` dans des terminaux distincts. Le client web
utilise `http://localhost:3000/v1` par défaut ; `VITE_API_BASE_URL` permet de
changer cette base.

Ne pas lancer les commandes `dev` lorsque les services Compose `api` et `web`
sont actifs : ils utilisent déjà les ports `3000` et `5173`. Pour développer
localement, exécuter d’abord `docker compose stop api web` tout en conservant
PostgreSQL, Redis et Mailpit.

## Migrations et administration

```bash
pnpm --filter api migrate:up
pnpm --filter api migrate:down
pnpm --filter api migrate:reset
pnpm --filter api promote:admin <email>
pnpm --filter api promote:admin:id <identifiant-utilisateur>
```

La migration `003_create_iam_security` ajoute la récupération de compte, le
MFA, l’audit, la configuration versionnée, les exports et les suppressions
différées. Le traitement périodique de purge et de suppression est exposé à
l’administration par `POST /v1/iam/admin/security/maintenance` et doit être
appelé par le planificateur du déploiement.

La migration `004_add_iam_aggregate_consistency` ajoute la version de session
des utilisateurs et la contrainte reliant une vérification à son utilisateur.

`migrate:reset` est destructif pour les données locales. Lire le script avant
de l’utiliser sur un environnement partagé. Le script de promotion est la
source de vérité pour sa syntaxe exacte.

## Points d’entrée

- API : `apps/api/src/main.ts`, puis `server.ts` ;
- composition : `apps/api/src/composition-root/application.module.ts` ;
- routes IAM : `apps/api/src/features/iam/routes/index.ts` ;
- vertical sécurité : `apps/api/src/security/security.routes.ts`, puis
  `security.service.ts` ;
- web : `apps/web/src/main.tsx`, puis `App.tsx` ;
- client HTTP web : `apps/web/src/services/api.ts`.
