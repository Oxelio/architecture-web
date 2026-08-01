# ADR-0006 — Séparer compte, identités de connexion et authentificateurs

**Statut : acceptée**

## Contexte

`UserEntity` regroupait l’existence du compte, son adresse e-mail et son mot de
passe. Ce modèle rendait l’e-mail obligatoire et confondait trois cycles de vie
différents : le compte, la manière de le retrouver et la preuve utilisée pour
s’authentifier. Il empêchait notamment un compte pseudonyme minimal sans
collecte d’adresse.

## Options considérées

1. Conserver tous les champs facultatifs dans `UserEntity`.
2. Faire de chaque identité et authentificateur un enfant d’un grand agrégat
   `User`.
3. Définir des racines distinctes reliées uniquement par l’identifiant du
   compte.

## Décision

IAM sépare les responsabilités suivantes :

- `UserEntity` représente le compte, son rôle, son statut et sa version de
  session ;
- `LoginIdentityEntity` représente un identifiant normalisé (`username` ou
  `email`) et son éventuelle vérification ;
- `PasswordAuthenticatorEntity` représente le dérivé de mot de passe et son
  cycle de vie ;
- `EmailVerificationEntity` cible une identité de connexion précise, pas
  seulement un utilisateur.

Ces concepts sont des racines d’agrégat distinctes. Ils se référencent par
objets-identifiants et leurs écritures coordonnées passent par
`IamUnitOfWork`. `UserRepository` reste un port de commande limité à la racine
`UserEntity`; `UserQueryRepository` construit les projections de lecture qui
réunissent compte et identités.

La politique de compte expose les types d’identifiants autorisés. Elle est
appliquée à l’inscription comme à la connexion. La vérification n’est exigible
que pour une identité e-mail et reste configurable. L’adresse e-mail est donc
facultative dans les contrats de lecture.

Les informations de profil comme nom, prénom, téléphone ou avatar ne sont pas
ajoutées à IAM. Elles appartiendront à un contexte de profil dédié lorsqu’un
besoin métier réel définira leurs règles et leur cycle de vie.

## Conséquences

- un compte peut fonctionner avec seulement un pseudonyme et un mot de passe ;
- ajouter un nouveau type d’identité ou d’authentificateur ne gonfle pas la
  racine utilisateur ;
- l’unicité globale d’un identifiant est protégée en base par son type et sa
  valeur normalisée ;
- chaque utilisateur possède au plus une identité de chaque type et un
  authentificateur de mot de passe ;
- les commandes touchant plusieurs racines doivent rester transactionnelles ;
- les consommateurs de lecture doivent accepter l’absence d’e-mail ;
- retirer un type d’identifiant de la politique empêche son utilisation pour
  les nouvelles inscriptions et connexions.

## Limites

Cette décision ne fournit pas encore téléphone, passkey, fédération ou méthode
sans mot de passe. Ces extensions devront introduire leurs objets métier,
ports, migrations, politiques et parcours complets avant d’être annoncées
comme disponibles.
