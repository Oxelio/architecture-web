# ADR-0004 — Agrégats et frontières de cohérence

**Statut : acceptée**

## Contexte

`UserEntity`, `SessionEntity` et `EmailVerificationEntity` possédaient déjà une
identité, des transitions et un repository distincts, sans déclarer leur rôle
de racine d’agrégat. Plusieurs commandes écrivaient successivement un
utilisateur et une vérification dans PostgreSQL. La connexion appliquait la
limite de sessions par une lecture suivie de suppressions et d’une écriture
Redis séparées.

## Options considérées

1. Conserver uniquement les entités et accepter les séquences d’écriture.
2. Construire un grand agrégat `User` contenant sessions et vérifications.
3. Déclarer trois agrégats unitaires et fournir une cohérence adaptée à chaque
   technologie.

## Décision

Foundation définit `AggregateRoot` comme spécialisation sans état d’`Entity`.
IAM déclare `UserEntity`, `SessionEntity` et `EmailVerificationEntity` comme
racines d’agrégat distinctes. Elles se référencent uniquement par identifiant.

`IamUnitOfWork` encadre dans une transaction Kysely les commandes PostgreSQL
qui écrivent les agrégats utilisateur et vérification. Les repositories reçus
dans son callback sont liés à la transaction.

`RedisSessionAdapter.saveEnforcingMaximum` sauvegarde une session et applique
la limite par utilisateur dans un script Redis atomique. Une version de session
portée par l’utilisateur et copiée dans chaque session invalide les sessions
antérieures à un changement de mot de passe.

## Conséquences

- une défaillance PostgreSQL ne peut plus laisser une moitié du changement
  utilisateur/vérification validée ;
- les sessions ne peuvent plus dépasser leur limite à cause de connexions
  concurrentes utilisant le cas d’utilisation IAM ;
- PostgreSQL et Redis restent deux systèmes sans transaction distribuée ;
- la résolution d’une session recharge l’utilisateur et refuse une version
  obsolète, ce qui rend la révocation après changement de mot de passe sûre
  même si le nettoyage Redis échoue ;
- ajouter une racine à une transaction exige d’étendre explicitement
  `IamTransactionalRepositories`.

## Limites ouvertes

L’e-mail de vérification est envoyé après le commit, mais aucun outbox durable
n’existe. Une telle évolution devra protéger le jeton brut au repos et définir
le worker, les reprises et l’idempotence avant d’être introduite.
