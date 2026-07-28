# Authentification et sessions

## Création

`POST /v1/identity/signin` valide les identifiants via `SignInUseCase`. Une
connexion réussie crée une `SessionEntity` d’une durée de 60 minutes et renvoie
un cookie `sid` `httpOnly`.

Le contrôleur extrait aussi :

- le type, le nom et la version du client depuis `User-Agent` ;
- le type d’appareil et le système d’exploitation lorsque détectables ;
- l’adresse IP fournie par Fastify.

Cette détection est indicative. Elle ne constitue pas une identification forte
de l’appareil.

## Stockage

`RedisSessionAdapter` enregistre chaque session sous `session:<sessionId>` avec
un TTL et indexe les identifiants actifs dans
`user-sessions:<userId>`. Les anciens enregistrements sans métadonnées restent
lisibles : les dates et détails absents sont exposés sous forme `null` par le
contrat applicatif.

PostgreSQL ne stocke pas les sessions actuelles.

## Résolution et activité

Le plugin Fastify lit le cookie, appelle `ResolveSessionUseCase` et peuple
`request.auth` avec `userId`, `sessionId` et `role`. La résolution refuse :

- cookie absent ou identifiant invalide ;
- session absente ou expirée ;
- utilisateur absent ou suspendu.

L’activité est actualisée au plus une fois toutes les cinq minutes afin
d’éviter une écriture Redis à chaque requête.

## Autorisation

Les routes protégées utilisent le hook `authenticate`. Les routes
administrateur ajoutent un contrôle `role === "admin"`. Les endpoints
`/me/sessions` transmettent toujours le `userId` authentifié au cas
d’utilisation : un client ne peut pas choisir le propriétaire.

La suspension d’un utilisateur révoque toutes ses sessions. Les changements de
mot de passe révoquent aussi les sessions conformément au cas d’utilisation.
Les opérations d’administration sensibles interdisent certaines actions sur
son propre compte via `user.self_administration_forbidden`.

Le changement de mot de passe vérifie d’abord le mot de passe actuel, puis la
confirmation et la [politique centralisée](password-policy.md). Les sessions ne
sont révoquées qu’après la validation et l’enregistrement réussis.

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
