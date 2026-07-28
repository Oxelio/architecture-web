# Sessions d’identité

Une session conserve son identifiant interne, son propriétaire, sa création, sa
dernière activité et son expiration. Elle peut aussi contenir des métadonnées
facultatives sur le client (type d’appareil, système, navigateur ou application)
et le réseau (adresse IP et localisation approximative).

## Collecte

L’adaptateur HTTP traduit le `User-Agent` et `request.ip` en métadonnées métier
au moment de la connexion. Le domaine ne dépend donc ni de Fastify ni d’une
bibliothèque d’analyse. `request.ip` n’utilise les en-têtes transférés que si
`TRUST_PROXY=true`; cette option ne doit être activée que derrière un proxy de
confiance.

La localisation est optionnelle. Le modèle et le contrat API sont prêts à la
recevoir, mais aucun fournisseur externe n’est requis. Une absence ou un échec
d’enrichissement ne doit jamais bloquer la connexion.

## Activité et rétention

La dernière activité est initialisée à la création. Lors de la résolution
d’une session, elle n’est persistée que si la valeur connue date d’au moins
cinq minutes. Redis conserve la durée de vie initiale lors de cette mise à jour.
Les sessions expirent selon la politique existante d’une heure et sont retirées
du stockage par leur TTL.

## Compatibilité et confidentialité

Les anciens enregistrements Redis restent valides : les dates et métadonnées
absentes sont exposées avec `null` ou des valeurs `unknown`. Aucune migration
Redis n’est nécessaire.

Les routes utilisateur dérivent toujours le propriétaire de `request.auth`.
Les routes administratives conservent leur contrôle de rôle. Les réponses
n’exposent jamais le cookie, un secret ou un jeton utilisable.

Le contrat de liste est enrichi de `userId`, `createdAt`, `lastActivityAt`,
`isActive`, `isCurrent`, `client` et `network`. Il s’agit d’un ajout compatible
pour les consommateurs qui ignorent les nouveaux champs.
