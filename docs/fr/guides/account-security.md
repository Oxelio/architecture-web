# Sécurité du compte, MFA, audit et configuration

Ce guide décrit l’implémentation actuellement portée par
`apps/api/src/security`. Il couvre la récupération de compte, le MFA TOTP,
l’audit, la configuration dynamique, les exports et la suppression différée.
Les spécifications fonctionnelles restent la source du comportement attendu ;
ce document décrit ce que le code exécute aujourd’hui.

## Placement architectural observé

`SecurityService` est construit dans
`apps/api/src/composition-root/application.module.ts` puis injecté à la fois :

- dans `buildSecurityRoutes`, pour les routes de sécurité ;
- dans `createIam` comme implémentation du port `SecondFactorGate`, afin que
  `SignInUseCase` suspende la création de session lorsqu’un second facteur est
  actif.

Ce module est une verticale hybride. Contrairement aux capacités historiques
du cœur IAM, il n’est pas composé de cas d’utilisation retournant `Result` et
d’adaptateurs de repository dédiés. Il importe directement Kysely, les ports de
session et de mot de passe, des objets du domaine, Nodemailer et les primitives
cryptographiques Node. `security.routes.ts` appelle donc un service concret et
transforme ses `SecurityError` en réponses HTTP.

Cette organisation est un **fait observé**, pas une nouvelle règle générale.
Elle constitue une exception aux frontières décrites pour
`packages/iam/core`. Aucun ADR ne décide encore si cette verticale doit rester
dans l’API ou migrer vers des ports et cas d’utilisation dédiés.

## Persistance et secrets

La migration
`packages/iam/infrastructure/persitence/kysely/src/persistence/migrations/003_create_iam_security.ts`
ajoute :

| Table                           | Responsabilité                                            |
| ------------------------------- | --------------------------------------------------------- |
| `iam_password_recoveries`       | jetons de récupération hachés, expiration et consommation |
| `iam_mfa_settings`              | secret TOTP chiffré et état d’enrôlement                  |
| `iam_mfa_backup_codes`          | dérivés SHA-256 des codes de secours et consommation      |
| `iam_mfa_challenges`            | challenges temporaires de connexion et confirmation       |
| `iam_security_audit_events`     | événements append-only, rétention et conservation légale  |
| `iam_security_config_revisions` | révisions publiées et remplacées                          |
| `iam_account_exports`           | état et archive ZIP temporaire                            |
| `iam_account_deletions`         | période de grâce, annulation et conservation éventuelle   |

Le trigger `iam_users_invalidate_recoveries` invalide les jetons de
récupération après changement d’adresse, changement de mot de passe ou passage
en attente de suppression.

Les jetons exploitables ne sont pas persistés. Les secrets TOTP sont chiffrés
avec AES-256-GCM à partir de `SECURITY_ENCRYPTION_KEY`. Une rotation de cette
clé **DOIT** inclure une migration contrôlée ; changer uniquement la variable
rend les secrets existants illisibles.

## Connexion et MFA

Après validation du mot de passe, `SignInUseCase` appelle
`SecondFactorGate.beginSignIn`. Sans MFA, il crée la session comme auparavant.
Avec MFA, il retourne un challenge et le contrôleur répond `202` sans cookie.
`POST /mfa/challenge/verify` consomme ensuite un TOTP ou un code de secours et
crée la session.

Un challenge actif est réutilisé pour le même compte jusqu’à son expiration :
ressaisir le bon mot de passe ne remet donc pas son compteur d’essais à zéro.
Un compteur TOTP déjà accepté n’est pas accepté une seconde fois. Les codes de
secours sont hachés, indépendants et consommés atomiquement.

L’enrôlement se termine en trois étapes : création du QR code, preuve d’un
premier TOTP, puis confirmation explicite de sauvegarde des codes de secours.
L’activation et la désactivation révoquent les sessions.

## Récupération, export et suppression

La demande de récupération retourne toujours une confirmation générique.
L’adresse et l’origine réseau ne sont conservées dans l’audit que sous forme
d’empreinte. Les limites s’appliquent au compte connu et à l’origine. La
consommation du jeton et le changement du hachage sont transactionnels, puis
les sessions Redis sont révoquées.

L’export produit une archive ZIP stockée temporairement en PostgreSQL. Elle
contient un manifeste, le compte, les sessions actives, les événements
accessibles et l’historique des demandes. Elle expire après 24 heures et son
premier téléchargement efface le contenu binaire.

Une demande de suppression place l’utilisateur dans l’état
`pending_deletion`, révoque ses sessions et crée un jeton d’annulation. La
maintenance supprime les comptes arrivés à échéance, pseudonymise leurs audits,
expire les archives et purge les audits hors rétention. Le dernier
administrateur actif est protégé.

`POST /admin/security/maintenance` est le seul déclencheur actuellement
composé. Le dépôt ne fournit pas de planificateur : le déploiement **DOIT**
appeler cette route périodiquement.

## Configuration dynamique réellement appliquée

La dernière révision `published` est relue depuis PostgreSQL ; aucun
redémarrage n’est nécessaire. La publication utilise un numéro de version
attendu, et l’API fournit prévisualisation et rollback.

| Groupe d’options                  | Consommateur actuel                          |
| --------------------------------- | -------------------------------------------- |
| inscription, changement d’adresse | hook global de `server.ts`                   |
| gestion des sessions              | hook global de `server.ts`                   |
| récupération                      | `SecurityService.requestRecovery`            |
| disponibilité et rôles MFA        | enrôlement, connexion et désactivation       |
| export et suppression             | parcours correspondants                      |
| rétention/consultation d’audit    | écriture, consultation et maintenance        |
| longueurs de mot de passe         | réinitialisation par récupération uniquement |

Les options `accounts.emailVerification` et `sessions.durationMinutes` sont
représentées mais ne pilotent aucun comportement. Les options dynamiques de mot
de passe ne remplacent pas le `PasswordPolicyValidator` construit au démarrage
pour l’inscription et le changement authentifié. L’interface d’administration
ne doit donc pas présenter ces trois zones comme universellement effectives.

## Audit et limites de preuve

Les routes IAM historiques produisent certains audits dans le hook
`onResponse`; les parcours de sécurité écrivent leurs événements depuis le
service. Une panne d’audit dans le hook est journalisée sans annuler une réponse
déjà envoyée.

Les tests actuels couvrent les primitives de politique, redaction, TOTP et ZIP,
ainsi que les suites existantes du monorepo. Ils ne constituent pas une suite
d’intégration exhaustive des transactions concurrentes, de la maintenance, du
SMTP ou de tous les parcours PostgreSQL/Redis. Cette limite **DOIT** rester
visible tant qu’une suite d’intégration dédiée n’existe pas.

Les routes de `security.routes.ts` n’ont pas de schémas TypeBox. Swagger peut
les lister sans décrire précisément leurs corps et réponses ; ce fichier et
`apps/web/src/services/api.ts` sont actuellement les sources exécutables les
plus précises pour ces contrats.
