# Référence de l’interface HTTP

## Source exécutable

L’API monte les routes sous `/v<version-majeure>/iam`. Avec la version
actuelle `1.0.0-alpha.1`, le préfixe est `/v1/iam`. Les schémas TypeBox
alimentent OpenAPI, consultable sur `GET /docs`.

Cette page décrit les frontières et niveaux d’accès. Les routes IAM utilisent
le préfixe `/v1/iam` et le centre de notifications `/v1/notifications`. Pour les routes historiques,
les fichiers `*.route-options.ts` et Swagger décrivent les corps, statuts et
réponses. Les routes de sécurité et de notifications déclarées dans
`apps/api/src/security/security.routes.ts` et
`apps/api/src/notifications/notification.routes.ts` ne possèdent pas encore de
schémas TypeBox : ces fichiers et `apps/web/src/services/api.ts` sont donc leur
source exécutable, et Swagger ne couvre pas encore toute l’API.

## Routes publiques

| Méthode | Chemin                      | Intention                                |
| ------- | --------------------------- | ---------------------------------------- |
| `GET`   | `/verify?token=...`         | vérifier une adresse                     |
| `POST`  | `/signup`                   | créer un compte                          |
| `GET`   | `/password-policy`          | lire la politique publique               |
| `POST`  | `/password-policy/evaluate` | évaluer un mot de passe                  |
| `POST`  | `/signin`                   | ouvrir une session                       |
| `POST`  | `/signout`                  | fermer la session désignée par le cookie |
| `POST`  | `/recovery`                 | demander une récupération de compte      |
| `POST`  | `/recovery/reset`           | réinitialiser le mot de passe            |
| `POST`  | `/mfa/challenge/verify`     | terminer une connexion avec MFA          |
| `POST`  | `/deletion/cancel`          | annuler une suppression par jeton        |

## Routes authentifiées

| Méthode  | Chemin                                    | Intention                            |
| -------- | ----------------------------------------- | ------------------------------------ |
| `POST`   | `/verify/resend`                          | renvoyer la vérification             |
| `GET`    | `/me`                                     | lire le profil                       |
| `PATCH`  | `/me/email`                               | changer l’adresse                    |
| `PATCH`  | `/me/password`                            | changer le mot de passe              |
| `GET`    | `/me/sessions`                            | lister ses sessions                  |
| `DELETE` | `/me/sessions/:sessionId`                 | révoquer une de ses sessions         |
| `GET`    | `/me/security-events`                     | consulter ses événements de sécurité |
| `GET`    | `/me/mfa`                                 | lire l’état MFA                      |
| `POST`   | `/me/mfa/enrollment`                      | commencer l’enrôlement TOTP          |
| `POST`   | `/me/mfa/enrollment/confirm`              | valider le premier code TOTP         |
| `POST`   | `/me/mfa/enrollment/backup-codes/confirm` | confirmer la sauvegarde des codes    |
| `POST`   | `/me/mfa/backup-codes`                    | régénérer les codes de secours       |
| `DELETE` | `/me/mfa`                                 | désactiver le MFA                    |
| `POST`   | `/me/exports`                             | demander un export de compte         |
| `GET`    | `/me/exports`                             | lister ses exports                   |
| `GET`    | `/me/exports/:exportId/download`          | télécharger une archive prête        |
| `POST`   | `/me/deletion`                            | programmer la suppression du compte  |

### Centre de notifications (`/v1/notifications`)

| Méthode | Chemin                  | Intention                                     |
| ------- | ----------------------- | --------------------------------------------- |
| `GET`   | `/`                     | lister ses notifications                      |
| `GET`   | `/unread-count`         | compter ses notifications non lues            |
| `POST`  | `/:notificationId/read` | marquer une notification comme lue            |
| `POST`  | `/read-all`             | marquer toutes ses notifications comme lues   |
| `GET`   | `/preferences`          | lire ses préférences par canal                |
| `PUT`   | `/preferences/:channel` | activer ou désactiver `email`, `slack`, `sms` |

## Routes administrateur

| Méthode  | Chemin                                        | Intention                               |
| -------- | --------------------------------------------- | --------------------------------------- |
| `GET`    | `/users`                                      | rechercher et paginer les utilisateurs  |
| `GET`    | `/users/overview`                             | lire les indicateurs globaux            |
| `PATCH`  | `/users/:userId/activate`                     | activer un utilisateur                  |
| `PATCH`  | `/users/:userId/suspend`                      | suspendre un utilisateur                |
| `PATCH`  | `/users/:userId/role`                         | attribuer `user` ou `admin`             |
| `GET`    | `/users/:userId/sessions`                     | lister ses sessions                     |
| `DELETE` | `/users/:userId/sessions/:sessionId`          | révoquer une session                    |
| `DELETE` | `/users/:userId/sessions`                     | révoquer toutes ses sessions            |
| `GET`    | `/admin/security/config`                      | lire la configuration publiée           |
| `PUT`    | `/admin/security/config`                      | publier une nouvelle révision           |
| `POST`   | `/admin/security/config/preview`              | prévisualiser une configuration         |
| `POST`   | `/admin/security/config/:revisionId/rollback` | republier une ancienne révision         |
| `GET`    | `/admin/security-events`                      | rechercher les événements d’audit       |
| `POST`   | `/admin/security/maintenance`                 | exécuter rétention et suppressions dues |

## Enveloppes

Le client web attend les succès JSON sous `{ "data": ... }`. La liste
administrative paginée ajoute
`{ "meta": { "pagination": { "page", "pageSize", "total", "totalPages" } } }`.
Ses paramètres facultatifs sont `search`, `role`, `status`, `emailVerified`,
`page` et `pageSize` (25 par défaut, 100 au maximum). Les indicateurs globaux
sont une ressource séparée dans `data` sur `/users/overview`.

Une réponse sans contenu utilise `204`. Les erreurs HTTP utilisent
`{ "error": { "code": "...", "message"?: "..." } }`.

`POST /signin` renvoie soit `204` avec le cookie de session, soit `202` avec
`mfaRequired`, `challengeId` et `expiresAt`. Dans ce second cas, aucun cookie
n’est émis avant la réussite de `POST /mfa/challenge/verify`.

### Consultation administrative

| Paramètre       | Valeurs                                  | Défaut | Règle                    |
| --------------- | ---------------------------------------- | ------ | ------------------------ |
| `search`        | chaîne, 200 caractères au maximum        | absent | e-mail ou identifiant    |
| `role`          | `user`, `admin`                          | absent | égalité                  |
| `status`        | `active`, `suspended`                    | absent | égalité                  |
| `emailVerified` | booléen                                  | absent | égalité                  |
| `page`          | entier strictement positif               | `1`    | page vide autorisée      |
| `pageSize`      | entier compris entre `1` et `100` inclus | `25`   | aucune valeur supérieure |

Les critères présents se combinent avec `ET`. Le total de
`meta.pagination.total` est calculé après application de ces critères.
`totalPages` vaut `0` lorsque le total est nul.

Une pagination invalide est normalement rejetée par le schéma Fastify. Les
erreurs applicatives `users.invalid_page` et `users.invalid_page_size`
garantissent aussi la règle depuis une autre interface ; le mapping HTTP les
expose respectivement sous `INVALID_PAGE` et `INVALID_PAGE_SIZE`.

Voir le guide [Administration des utilisateurs](../guides/iam-user-administration.md)
pour le flux complet entre application, persistance et client.
Voir aussi [Sécurité du compte](../guides/account-security.md) pour les flux de
récupération, MFA, audit, configuration, export et suppression.

Les codes métier sont définis près de chaque cas d’utilisation dans
`*.codes.ts`. Les mappings vers HTTP sont définis dans `*.http.ts`. Les codes
transverses `UNAUTHORIZED` et `FORBIDDEN` sont produits par les hooks
d’authentification et d’autorisation.

Un compte conserve au maximum 10 sessions actives. Une nouvelle connexion
au-delà de cette borne révoque d’abord la session active la plus ancienne ; les
listes de sessions restent ainsi bornées sans pagination.

`POST /signup` exige `email`, `password` et `passwordConfirmation`.
`PATCH /me/password` exige `currentPassword`, `password` et
`passwordConfirmation`. Les confirmations sont comparées exactement puis
abandonnées ; elles ne sont jamais transmises à la persistance.

## Version et changements cassants

Changer un chemin, une méthode, un statut, une enveloppe, un champ obligatoire
ou la signification d’un code est cassant pour le client. Le client web, les
schémas, les presenters, les tests et cette référence **DOIVENT** évoluer
ensemble. Le dépôt dérive actuellement la version d’URL de la version majeure
du package API ; aucune politique de dépréciation parallèle n’est définie.
