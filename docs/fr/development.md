# Guide développeur

## Prérequis

- Node.js 20+
- pnpm
- Docker si vous souhaitez exécuter l’environnement complet

## Installation

Depuis la racine du dépôt :

```bash
pnpm install
```

## Configuration

L’application API attend des variables d’environnement pour la base de données, Redis, et SMTP. Ces variables sont lues par [apps/api/src/config/app.config.ts](../../apps/api/src/config/app.config.ts).

## Exécution

### API

```bash
cd apps/api
pnpm dev
```

### Migrations

```bash
cd apps/api
pnpm migrate:up
```

## Build et vérification

```bash
pnpm --filter api build
pnpm --filter @architecture/identity build
```

## Débogage

Le point d’entrée principal est [apps/api/src/main.ts](../../apps/api/src/main.ts). Pour comprendre un flux complet, commencez par :

- la route dans [apps/api/src/routes/identity.routes.ts](../../apps/api/src/routes/identity.routes.ts),
- le cas d’usage concerné dans [bounded-contexts/identity/application/use-cases](../../bounded-contexts/identity/application/use-cases),
- et l’adaptateur infrastructure associé.

## Ajouter une nouvelle fonctionnalité

1. identifier le bounded context concerné,
2. définir les règles métier dans le domaine,
3. créer un use case applicatif,
4. ajouter les ports nécessaires,
5. implémenter les adaptateurs,
6. exposer la fonctionnalité via l’API.

## Bonnes pratiques

- garder les cas d’usage petits et cohérents,
- éviter les dépendances directes au framework web dans le domaine,
- faire évoluer les abstractions avec parcimonie,
- documenter les choix non évidents.
