# Référence de l’interface HTTP

## Source exécutable

L’API monte les routes sous `/v<version-majeure>/identity`. Avec la version
actuelle `1.0.0-alpha.1`, le préfixe est `/v1/identity`. Les schémas TypeBox
alimentent OpenAPI, consultable sur `GET /docs`.

Cette page décrit les frontières et niveaux d’accès. Pour les corps, statuts et
réponses exacts, Swagger et les fichiers `*.route-options.ts` sont les sources
de vérité.

## Routes publiques

| Méthode | Chemin                      | Intention                                |
| ------- | --------------------------- | ---------------------------------------- |
| `GET`   | `/verify?token=...`         | vérifier une adresse                     |
| `POST`  | `/signup`                   | créer un compte                          |
| `GET`   | `/password-policy`          | lire la politique publique               |
| `POST`  | `/password-policy/evaluate` | évaluer un mot de passe                  |
| `POST`  | `/signin`                   | ouvrir une session                       |
| `POST`  | `/signout`                  | fermer la session désignée par le cookie |

## Routes authentifiées

| Méthode  | Chemin                    | Intention                    |
| -------- | ------------------------- | ---------------------------- |
| `POST`   | `/verify/resend`          | renvoyer la vérification     |
| `GET`    | `/me`                     | lire le profil               |
| `PATCH`  | `/me/email`               | changer l’adresse            |
| `PATCH`  | `/me/password`            | changer le mot de passe      |
| `GET`    | `/me/sessions`            | lister ses sessions          |
| `DELETE` | `/me/sessions/:sessionId` | révoquer une de ses sessions |

## Routes administrateur

| Méthode  | Chemin                               | Intention                    |
| -------- | ------------------------------------ | ---------------------------- |
| `GET`    | `/users`                             | lister les utilisateurs      |
| `PATCH`  | `/users/:userId/activate`            | activer un utilisateur       |
| `PATCH`  | `/users/:userId/suspend`             | suspendre un utilisateur     |
| `PATCH`  | `/users/:userId/role`                | attribuer `user` ou `admin`  |
| `GET`    | `/users/:userId/sessions`            | lister ses sessions          |
| `DELETE` | `/users/:userId/sessions/:sessionId` | révoquer une session         |
| `DELETE` | `/users/:userId/sessions`            | révoquer toutes ses sessions |

## Enveloppes

Le client web attend les succès JSON sous `{ "data": ... }`. Une réponse sans
contenu utilise `204`. Les erreurs HTTP utilisent
`{ "error": { "code": "...", "message"?: "..." } }`.

Les codes métier sont définis près de chaque cas d’utilisation dans
`*.codes.ts`. Les mappings vers HTTP sont définis dans `*.http.ts`. Les codes
transverses `UNAUTHORIZED` et `FORBIDDEN` sont produits par les hooks
d’authentification et d’autorisation.

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
