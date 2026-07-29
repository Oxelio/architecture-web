# Authentification et sessions

## Création

`POST /v1/iam/signin` valide les identifiants via `SignInUseCase`. Une
connexion réussie crée une `SessionEntity` d’une durée de 60 minutes et renvoie
un cookie `sid` `httpOnly`.

Lorsque le MFA est actif, la validation du mot de passe ne crée pas encore de
session. `SignInUseCase` retourne le challenge fourni par `SecondFactorGate`,
le contrôleur répond `202`, puis `POST /v1/iam/mfa/challenge/verify` crée la
session après validation du second facteur. Voir le
[guide de sécurité](account-security.md).

`SignInUseCase` demande au repository d’enregistrer la session avec une limite
de 10 sessions actives. L’adaptateur Redis sauvegarde, nettoie l’index expiré et
révoque les sessions excédentaires dans un même script atomique. La création
après MFA utilise la même opération.

Le contrôleur extrait aussi :

- le type, le nom et la version du client depuis `User-Agent` ;
- le type d’appareil et le système d’exploitation lorsque détectables ;
- l’adresse IP fournie par Fastify.

Cette détection est indicative. Elle ne constitue pas une identification forte
de l’appareil.

## Stockage

`RedisSessionAdapter` enregistre chaque session sous `session:<sessionId>` avec
un TTL et indexe les identifiants actifs dans
`user-sessions:<userId>`. Le format est volontairement strict : `userId`,
`userSessionVersion`, `expiresAt`, `createdAt` et `lastActivityAt` doivent être
présents et valides. Un enregistrement incomplet ou invalide est rejeté au
chargement. `client` et `network` restent facultatifs.

PostgreSQL ne stocke pas les sessions actuelles.

## Résolution et activité

Le plugin Fastify lit le cookie, appelle `ResolveSessionUseCase` et peuple
`request.auth` avec `userId`, `sessionId` et `role`. La résolution refuse :

- cookie absent ou identifiant invalide ;
- session absente ou expirée ;
- utilisateur absent ou suspendu.
- version de session différente de la version actuelle de l’utilisateur.

L’état `pending_deletion` est également refusé, car la résolution exige
désormais un compte actif.

L’activité est actualisée au plus une fois toutes les cinq minutes afin
d’éviter une écriture Redis à chaque requête.

## Autorisation

Les routes protégées utilisent le hook `authenticate`. Les routes
administrateur ajoutent un contrôle `role === "admin"`. Les endpoints
`/me/sessions` transmettent toujours le `userId` authentifié au cas
d’utilisation : un client ne peut pas choisir le propriétaire.

La suspension d’un utilisateur révoque toutes ses sessions. Les changements de
mot de passe révoquent aussi les sessions conformément au cas d’utilisation.
La récupération de compte, l’activation ou la désactivation du MFA et la
demande de suppression révoquent également les sessions.
Les opérations d’administration sensibles interdisent certaines actions sur
son propre compte via `user.self_administration_forbidden`.

Le changement de mot de passe vérifie d’abord le mot de passe actuel, puis la
confirmation et la [politique centralisée](password-policy.md). La sauvegarde
incrémente `sessionVersion` avant le nettoyage Redis. Une ancienne session est
donc refusée à sa prochaine résolution même si le nettoyage Redis échoue.

## Consultation et révocation

Un utilisateur peut lister ses sessions et en révoquer une. Un administrateur
peut lister les sessions d’un utilisateur, en révoquer une ou toutes. Le contrat
indique la session courante, les dates, le client et le réseau.

La localisation approximative existe dans le modèle de session et le contrat,
mais aucune résolution géographique d’adresse IP n’est composée actuellement.
Elle reste donc absente (`null`) tant qu’aucun mécanisme dédié ne l’alimente.

## Sécurité et confidentialité

- Le cookie **DOIT** rester `httpOnly`.
- En production HTTPS inter-sites, `COOKIE_SECURE=true` produit
  `SameSite=None; Secure`.
- `TRUST_PROXY=true` **DOIT** être activé uniquement derrière un proxy de
  confiance, car `request.ip` influence les métadonnées collectées.
- Les adresses IP et informations client sont des données sensibles. Toute
  rétention, géolocalisation ou exposition supplémentaire nécessite une
  décision produit et conformité.

La configuration dynamique représente `sessions.durationMinutes`, mais
`SessionEntity` conserve actuellement sa durée codée de 60 minutes. Modifier
cette option ne change donc pas le TTL réel.
