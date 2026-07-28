# Couches et frontières

## Foundation

`packages/foundation` fournit `Entity`, `Identifier`, `ValueObject`, `Result` et
`ValueOf`. Il ne contient aucune règle propre à l’identité.

Il **PEUT** contenir une primitive générique utile à plusieurs domaines. Il
**NE DOIT PAS** importer un package métier, une application ou une technologie
d’infrastructure. Ajouter une abstraction à Foundation augmente le couplage de
tous ses consommateurs ; cette décision **DEVRAIT** donc répondre à au moins
deux usages réels.

## Domaine Identity

`packages/identity/core/domain` contient les entités et objets-valeur. Une
entité porte une identité et des transitions métier ; un objet-valeur valide et
encapsule une valeur sans identité propre.

Le domaine **PEUT** dépendre de Foundation et de ses propres types. Il **NE DOIT
PAS** importer les cas d’utilisation, Fastify, React, Kysely, Redis, un SDK
d’e-mail ou un adaptateur.

Exemples :

- `UserEntity` change l’e-mail, le mot de passe, le rôle et le statut ;
- `SessionEntity` définit sa durée de vie et expose sa validité ;
- `EmailValueObject.create` retourne un `Result` de validation.

Les factories statiques `create` et `rehydrate` ont des intentions distinctes :
`create` construit un nouvel état valide et applique les valeurs par défaut ;
`rehydrate` restaure un état déjà persisté.

## Application Identity

`packages/identity/core/application` expose les cas d’utilisation, leurs
entrées/sorties, leurs codes et les ports nécessaires. Un cas d’utilisation
orchestre une intention métier et retourne un `Result`.

Cette couche **PEUT** dépendre du domaine, de Foundation et des ports qu’elle
définit. Elle **NE DOIT PAS** dépendre d’une implémentation Kysely, Redis,
Argon2, Nodemailer, Postmark ou Fastify.

Les repositories et services abstraits sont des ports secondaires :

- repositories pour utilisateurs, vérifications et sessions ;
- services pour hachage, e-mail et limitation de débit.

`createIdentity` est la factory applicative. Elle reçoit
`IdentityDependencies` et retourne l’ensemble `IdentityApplication` des cas
d’utilisation.

## Infrastructure

Chaque package sous `packages/identity/infrastructure` adapte une technologie à
un port de `@architecture/identity/application`. Il **DOIT** déclarer sa
compatibilité avec `implements`, comme
`RedisSessionAdapter implements SessionAdministrationRepository`.

Un adaptateur **PEUT** dépendre des exports publics `application` et `domain` du
cœur Identity et de sa bibliothèque technique. Il **NE DOIT PAS** importer les
fichiers internes du cœur via un chemin relatif ou contourner ses exports.

Les mappers de persistance appartiennent à l’infrastructure. Par exemple,
`UserMapper` convertit les lignes Kysely en `UserEntity` et rejette les données
persistées invalides avec `InvalidPersistenceDataError`.

## API Fastify

`apps/api` est à la fois adaptateur primaire HTTP et composition root :

- `server.ts` configure Fastify, CORS, Swagger, l’authentification et les routes ;
- `composition-root` crée PostgreSQL, Redis et les adaptateurs, puis appelle
  `createIdentity` ;
- `features/identity` regroupe contrôleur, contrat HTTP, presenter et options de
  route par fonctionnalité ;
- `routes` sépare les routes publiques, protégées et administrateur.

La connaissance des implémentations concrètes est autorisée dans
`composition-root`, pas dans les contrôleurs. Les contrôleurs **DOIVENT**
appeler les interfaces de cas d’utilisation.

## Application React

`apps/web` est un client HTTP indépendant du package métier. Il utilise React
Router, React Query, React Hook Form, Zod et i18next. `src/services/api.ts`
centralise les contrats de transport utilisés par l’interface.

Le client **NE DOIT PAS** importer les entités du domaine comme modèle d’état
UI. Il dépend du contrat HTTP, notamment parce que les dates sont sérialisées en
chaînes ISO et que les erreurs sont adaptées au transport.
