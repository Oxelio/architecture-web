# Couches et frontières

## Foundation

`packages/foundation` fournit `AggregateRoot`, `DomainEvent`, `Entity`,
`Identifier`, `ValueObject`, `Result` et `ValueOf`. Il ne contient aucune règle
propre à l’identité. `AggregateRoot` marque l’entrée d’une frontière de
cohérence et collecte les événements métier sans introduire de dépendance vers
un repository ou une base de données.

Il **PEUT** contenir une primitive générique utile à plusieurs domaines. Il
**NE DOIT PAS** importer un package métier, une application ou une technologie
d’infrastructure. Ajouter une abstraction à Foundation augmente le couplage de
tous ses consommateurs ; cette décision **DEVRAIT** donc répondre à au moins
deux usages réels.

## Domaine IAM

`packages/iam/core/domain` contient les entités et objets-valeur. Une
entité porte une identité et des transitions métier ; un objet-valeur valide et
encapsule une valeur sans identité propre.

Le domaine **PEUT** dépendre de Foundation et de ses propres types. Il **NE DOIT
PAS** importer les cas d’utilisation, Fastify, React, Kysely, Redis, un SDK
d’e-mail ou un adaptateur.

Exemples :

- `UserEntity` change l’e-mail, le mot de passe, le rôle et le statut ;
- `SessionEntity` définit sa durée de vie et expose sa validité ;
- `EmailValueObject.create` retourne un `Result` de validation.

`UserEntity`, `SessionEntity` et `EmailVerificationEntity` sont les trois
racines d’agrégat actuelles. Un repository **DOIT** charger ou sauvegarder une
racine, jamais permettre la modification directe d’un objet interne à
l’agrégat. Les références entre agrégats **DOIVENT** utiliser leurs
identifiants.

Les factories statiques `create` et `rehydrate` ont des intentions distinctes :
`create` construit un nouvel état valide et applique les valeurs par défaut ;
`rehydrate` restaure un état déjà persisté.

## Application IAM

`packages/iam/core/application` expose les cas d’utilisation, leurs
entrées/sorties, leurs codes et les ports nécessaires. Un cas d’utilisation
orchestre une intention métier et retourne un `Result`.

Cette couche **PEUT** dépendre du domaine, de Foundation et des ports qu’elle
définit. Elle **NE DOIT PAS** dépendre d’une implémentation Kysely, Redis,
Argon2, Nodemailer, Postmark ou Fastify.

Les repositories et services abstraits sont des ports secondaires :

- repositories pour utilisateurs, vérifications et sessions ;
- services pour hachage, e-mail et limitation de débit.
- `IamUnitOfWork` pour une transaction couvrant les repositories PostgreSQL
  d’utilisateurs et de vérifications.

`SecondFactorGate` est un port particulier appelé par `SignInUseCase`. Son
implémentation composée est `SecurityService`, située dans l’API plutôt que
dans un package d’infrastructure.

Les opérations cohérentes utilisant la même implémentation sont regroupées :
`UserRepository` porte les écritures, recherches de compte, consultation
administrative bornée et indicateurs ; `SessionRepository` porte le cycle de
vie et la consultation des sessions. Un nom de port ne constitue pas un
mécanisme d’autorisation : celle-ci reste dans les cas d’utilisation.

`createIam` est la factory applicative. Elle reçoit
`IamDependencies` et retourne l’ensemble `IamApplication` des cas
d’utilisation.

Les commandes d’administration reçoivent obligatoirement l’identifiant de
l’acteur. `AdministratorAuthorizer` recharge cet acteur depuis le repository et
vérifie qu’il est actif et administrateur : cette règle ne dépend donc pas de
Fastify. Les opérations sur les sessions personnelles utilisent des cas
d’utilisation distincts des opérations administratives.

## Infrastructure

Chaque package sous `packages/iam/infrastructure` adapte une technologie à
un port de `@architecture/iam/application`. Il **DOIT** déclarer sa
compatibilité avec `implements`, comme
`RedisSessionAdapter implements SessionRepository`.

Un adaptateur **PEUT** dépendre des exports publics `application` et `domain` du
cœur IAM et de sa bibliothèque technique. Il **NE DOIT PAS** importer les
fichiers internes du cœur via un chemin relatif ou contourner ses exports.

Les mappers de persistance appartiennent à l’infrastructure. Par exemple,
`UserMapper` convertit les lignes Kysely en `UserEntity` et rejette les données
persistées invalides avec `InvalidPersistenceDataError`.

`KyselyIamUnitOfWorkAdapter` fournit aux commandes des repositories liés à une
même transaction. `RedisSessionAdapter.saveEnforcingMaximum` utilise un script
Redis unique pour sauvegarder la session, nettoyer l’index expiré et révoquer
les sessions excédentaires.

## Messaging, Audit et Notifications

`packages/messaging` porte les contrats d’événement d’intégration, l’outbox
PostgreSQL, le routeur interne et son worker. C’est une infrastructure
transverse, pas du Shared Kernel métier.

`packages/audit` est un bounded context append-only. Il reçoit les événements
d’intégration et les tentatives applicatives ou de sécurité, applique la
redaction et expose les recherches, exports, rétentions et pseudonymisations.

`packages/notifications` est un bounded context distinct. Il transforme les
faits reçus en notifications destinées aux utilisateurs ou administrateurs,
conserve leur état lu/non lu et programme les livraisons e-mail, Slack ou SMS
selon les préférences et les politiques obligatoires. Les adaptateurs de canal
restent à l’extérieur de ce package.

## API Fastify

`apps/api` est à la fois adaptateur primaire HTTP et composition root :

- `server.ts` configure Fastify, CORS, Swagger, l’authentification et les routes ;
- `composition-root` crée PostgreSQL, Redis et les adaptateurs, puis appelle
  `createIam` ;
- `features/iam` regroupe contrôleur, contrat HTTP, presenter et options de
  route par fonctionnalité ;
- `routes` sépare les routes publiques, protégées et administrateur.

`apps/api/src/security` constitue une seconde organisation HTTP. Il regroupe un
service concret, ses types et ses routes publiques, protégées et
administrateur. Ce service orchestre directement Kysely et plusieurs ports
techniques. Il ne respecte donc pas la séparation contrôleur/cas
d’utilisation/adaptateur décrite ci-dessus pour `features/iam`.

Pour `features/iam`, la connaissance des implémentations concrètes est autorisée
dans `composition-root`, pas dans les contrôleurs, qui **DOIVENT** appeler les
interfaces de cas d’utilisation. `security.routes.ts` est une exception
observée : ses handlers appellent directement `SecurityService`.

## Application React

`apps/web` est un client HTTP indépendant du package métier. Il utilise React
Router, React Query, React Hook Form, Zod et i18next. `src/services/api.ts`
centralise les contrats de transport utilisés par l’interface.

Le client **NE DOIT PAS** importer les entités du domaine comme modèle d’état
UI. Il dépend du contrat HTTP, notamment parce que les dates sont sérialisées en
chaînes ISO et que les erreurs sont adaptées au transport.
