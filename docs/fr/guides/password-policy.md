# Politique de mot de passe

## Architecture

La politique est centralisée dans le cœur `iam` et ne dépend ni de HTTP,
ni de Zod, ni d’un algorithme de hachage. `PasswordPolicyValidator` reçoit trois
ports : évaluation de robustesse, détection des mots de passe courants et
détection des mots de passe compromis. L’API compose actuellement un évaluateur
heuristique et deux petites listes locales remplaçables.

Le value object du mot de passe en clair reste volontairement permissif pour
l’authentification des comptes existants. La politique active s’applique
uniquement lorsqu’un mot de passe est créé ou remplacé.

La longueur est mesurée en **points de code Unicode**. Aucune normalisation,
suppression d’espace ou troncature n’est effectuée. Les espaces, Unicode et
phrases de passe sont acceptés.

## Niveaux et valeurs par défaut

| Niveau              |                   Minimum | Robustesse minimale |
| ------------------- | ------------------------: | ------------------- |
| `standard`          |                        12 | `weak`              |
| `elevated` (défaut) |                        15 | `acceptable`        |
| `critical`          |                        20 | `strong`            |
| `custom`            | configurable, 15 par base | configurable        |

La longueur maximale par défaut est 128, et ne peut pas être configurée sous 64. Les règles de composition sont désactivées par défaut. Les comptes
administrateurs utilisent le niveau `critical` par défaut lors d’un changement.

## Configuration

La dernière révision publiée du centre de sécurité est l’unique source de
policy. `SecurityService` implémente `IamPolicyProvider` et construit à la
demande la policy standard ou privilégiée utilisée par
`PasswordPolicyValidator`.

Le schéma versionné `apps/api/src/security/security-policy.ts` définit les
niveaux, longueurs, contrôles et règles de composition. Les anciennes variables
`PASSWORD_*` ont été retirées de la configuration de démarrage. L’inscription,
le changement authentifié, le contrat public et l’évaluation utilisent donc la
même révision persistée. La récupération applique encore sa validation dans
`SecurityService` et doit être migrée vers le validateur partagé pour couvrir
tous les contrôles au-delà de la longueur.

## Contrats HTTP

- `GET /v1/iam/password-policy` expose uniquement les exigences publiques ;
- `POST /v1/iam/password-policy/evaluate` retourne `valid`, une catégorie
  de robustesse stable et des codes d’erreur, sans retourner le mot de passe ;
- l’inscription exige `password` et `passwordConfirmation` ;
- le changement exige `currentPassword`, `password` et
  `passwordConfirmation`.

Ces nouveaux champs obligatoires constituent une modification incompatible des
deux contrats d’écriture antérieurs.

## Hachage et compatibilité

L’API utilise Argon2id. L’adaptateur bcrypt préhache désormais les nouvelles
valeurs avec SHA-256 et marque les hachages `bcrypt-sha256:` afin d’éviter la
troncature bcrypt à 72 octets. Il conserve un chemin de vérification pour les
anciens hachages bcrypt non marqués.

Les mots de passe existants ne sont pas réévalués lors de la connexion.

## Limites actuelles

Le parcours de réinitialisation applique encore seulement les bornes de longueur
dynamiques et n’appelle pas `PasswordPolicyValidator`. Les parcours
d’invitation, d’activation avec définition de mot de passe et de définition
administrative restent absents.

L’historique des mots de passe n’existe pas dans le modèle de persistance ; seul
le refus du mot de passe actuel est implémenté. Les listes locales embarquées
sont un mécanisme de secours minimal : un déploiement sensible doit injecter un
jeu de données maintenu ou un service respectant la confidentialité. Comme
aucun service distant n’est composé, il n’existe actuellement aucun mode
d’indisponibilité externe à configurer.

La limitation de débit des changements de mot de passe et de l’évaluation
publique reste une responsabilité de la passerelle ou du proxy de déploiement ;
elle n’est pas dupliquée dans le module `iam`.
