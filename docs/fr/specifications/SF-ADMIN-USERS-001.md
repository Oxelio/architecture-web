# Recherche et pagination de l’administration des utilisateurs

> **Identifiant :** SF-ADMIN-USERS-001
>
> **Statut :** Implémentée
>
> **Documentation liée :**
> [Packages et API publiques](../architecture/packages.md),
> [Ajouter une fonctionnalité](../development/adding-a-feature.md),
> [Interface HTTP](../reference/http-api.md)

## Contexte métier

L’administration IAM permet actuellement à un administrateur de consulter les
utilisateurs, de rechercher un compte par adresse e-mail ou identifiant, de
filtrer les comptes par rôle ou statut, puis d’agir sur le compte sélectionné.

L’implémentation actuelle charge cependant tous les utilisateurs depuis la base
de données et retourne la collection complète au client. La recherche, les
filtres et les statistiques sont ensuite calculés dans l’application React.

Ce fonctionnement est acceptable pour un très faible volume, mais la taille de
la réponse et le coût de chaque rafraîchissement augmentent avec le nombre total
de comptes. L’endpoint n’est pas borné et ne constitue donc pas une base durable
pour une administration appelée à grandir.

## État actuel observé

Au moment de la rédaction de cette spécification :

- `ListUsersUseCase` ne reçoit que l’identifiant de l’administrateur ;
- `UserAdministrationRepository.findAll()` retourne toutes les entités
  utilisateur ;
- `KyselyUserAdapter.findAll()` trie les utilisateurs par date de création
  décroissante ;
- `GET /iam/users` ne possède aucun paramètre de requête ;
- le client HTTP retourne directement un tableau `AdminUser[]` ;
- `AdminPage` effectue la recherche et les filtres en mémoire ;
- les indicateurs total, actifs, suspendus et administrateurs sont calculés à
  partir de ce même tableau complet.

Ces éléments décrivent l’existant et non le comportement cible.

## Objectif fonctionnel

Fournir une consultation administrative bornée et cohérente permettant :

1. de rechercher un utilisateur sans charger tous les comptes ;
2. de filtrer les utilisateurs côté serveur ;
3. de parcourir les résultats page par page ;
4. de conserver des indicateurs globaux exacts indépendamment de la page
   affichée ;
5. de préserver les actions administratives existantes ;
6. de disposer de contrats cohérents entre application, API, persistance et
   interface web.

## Acteur et autorisation

Seul un utilisateur authentifié possédant le rôle administrateur peut consulter
la liste ou les indicateurs administratifs.

Les nouveaux paramètres de recherche et de pagination ne modifient pas la règle
d’autorisation existante. L’autorisation doit être vérifiée avant d’interroger
ou de retourner les données administratives.

Un utilisateur non administrateur ne doit obtenir ni résultat, ni total, ni
indicateur permettant d’inférer l’existence ou l’état d’autres comptes.

## Recherche et filtres

La liste doit accepter les critères facultatifs suivants :

- `search` : recherche par adresse e-mail ou identifiant utilisateur ;
- `role` : `user` ou `admin` ;
- `status` : `active` ou `suspended` ;
- `emailVerified` : compte vérifié ou non vérifié.

La recherche doit respecter les règles suivantes :

- les espaces placés avant et après la valeur sont ignorés ;
- une valeur vide après normalisation équivaut à l’absence de recherche ;
- la recherche sur l’adresse e-mail est insensible à la casse ;
- la recherche sur l’identifiant accepte une correspondance partielle afin de
  préserver le comportement actuel de l’interface ;
- la taille du terme de recherche est bornée par le contrat HTTP ;
- plusieurs filtres actifs sont combinés avec une logique `ET`.

La première version n’a pas besoin de prendre en charge une syntaxe de recherche
avancée, les expressions régulières ou la recherche approximative.

## Pagination

La liste utilise une pagination par numéro de page.

Les valeurs initiales sont :

- page par défaut : `1` ;
- taille de page par défaut : `25` ;
- taille de page maximale : `100`.

Les règles suivantes s’appliquent :

- la page et la taille de page sont des entiers strictement positifs ;
- une taille supérieure au maximum est refusée par le contrat plutôt que
  silencieusement acceptée ;
- une page valide sans résultat retourne une collection vide ;
- aucun endpoint de liste ne doit permettre de contourner la taille maximale ;
- le total correspond au nombre de comptes satisfaisant la recherche et les
  filtres courants.

Une pagination par curseur pourra remplacer ce modèle si le volume ou les
mesures de performance le justifient. Elle n’est pas demandée par cette
spécification.

## Ordre des résultats

La première version conserve un ordre fixe :

1. date de création décroissante ;
2. identifiant utilisateur décroissant pour départager deux dates identiques.

L’ordre doit être déterministe afin qu’un utilisateur ne change pas
arbitrairement de page lorsque les données restent inchangées.

Le tri configurable par colonne est hors périmètre de la première version.

## Résultat attendu

Le cas d’usage de liste doit retourner une structure métier explicite,
indépendante de sa représentation HTTP, équivalente à :

```text
ListUsersResult
- users
- pagination
  - page
  - pageSize
  - total
  - totalPages
```

`users` contient les représentations administratives déjà exposées :

- identifiant ;
- adresse e-mail ;
- rôle ;
- statut ;
- état de vérification de l’adresse e-mail ;
- date de création ;
- date de dernière modification.

Le contrat public ne doit pas exposer le mot de passe haché ni une autre donnée
interne inutile à l’administration.

Le repository peut retourner une structure plus proche de la persistance,
composée de la page d’entités et du total correspondant aux critères. Le cas
d’usage reste responsable de construire le résultat applicatif et de calculer
les métadonnées dérivées telles que `totalPages`.

Les noms génériques `data` et `meta` ne doivent pas être introduits dans les
contrats du bounded context. Ils décrivent une convention de représentation et
non le langage de l’application IAM.

## Représentation HTTP

Le presenter HTTP transforme le résultat applicatif en une enveloppe stable :

```json
{
  "data": [
    {
      "userId": "8da4d811-0196-4c40-a878-d89730725683",
      "email": "user@example.com",
      "role": "user",
      "status": "active",
      "isEmailVerified": true,
      "createdAt": "2026-07-29T08:00:00.000Z",
      "updatedAt": "2026-07-29T08:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "total": 142,
      "totalPages": 6
    }
  }
}
```

La convention HTTP est la suivante :

- `data` contient la ressource ou la collection demandée ;
- `meta` contient les informations de représentation qui accompagnent la
  ressource ;
- la pagination est placée dans `meta.pagination` ;
- `meta` reste facultatif pour les réponses qui n’ont aucune métadonnée ;
- l’API ne doit pas produire un objet `meta` vide ;
- les statistiques administratives, puisqu’elles constituent une ressource
  séparée, sont placées dans `data` et non dans `meta`.

Les faits de pagination sont calculés ou transportés par le bounded context,
mais le choix des clés `data`, `meta` et `pagination` dans la réponse publique
appartient à l’adapter HTTP.

## Indicateurs administratifs

Les indicateurs affichés au-dessus de la liste représentent l’ensemble des
utilisateurs et non la seule page courante.

Ils doivent au minimum exposer :

- nombre total de comptes ;
- nombre de comptes actifs ;
- nombre de comptes suspendus ;
- nombre de comptes administrateurs.

Ces indicateurs sont fournis par un cas d’usage et un endpoint distincts de la
liste paginée. Ils ne changent pas avec les critères de recherche de la liste.

Cette séparation permet de mettre en cache et de rafraîchir la liste et les
indicateurs indépendamment. Après une modification de rôle ou de statut, le
client doit invalider les deux données.

## Expérience utilisateur

L’interface d’administration doit :

- envoyer les filtres actifs à l’API ;
- inclure tous les critères dans la clé de cache React Query ;
- revenir à la première page lorsqu’un critère change ;
- limiter les appels pendant la saisie avec un délai court, par exemple
  300 millisecondes ;
- afficher le total des résultats et la position dans la pagination ;
- fournir les commandes page précédente et page suivante ;
- désactiver les commandes impossibles ;
- distinguer chargement initial, rafraîchissement, liste vide et erreur ;
- conserver les libellés et retours localisés ;
- fermer ou réconcilier le panneau de détail si l’utilisateur sélectionné
  n’appartient plus à la page ou aux filtres courants.

Les critères et la page devraient être synchronisés avec l’URL afin de rendre la
vue rechargeable et partageable sans en faire une condition bloquante de la
première livraison.

## Orientation des contrats de repository

Cette évolution ne doit pas multiplier les ports à une méthode sans besoin
concret.

Pour l’état actuel du module :

- `UserAdministrationRepository` doit être supprimé ;
- les opérations utilisateur cohérentes restent regroupées dans
  `UserRepository` ;
- `findAll()` doit être remplacé par une opération bornée, par exemple
  `search(criteria)` ;
- `SessionListingRepository` doit être supprimé ;
- `findActiveForUser()` doit rejoindre `SessionRepository`.

Ce regroupement est adapté tant qu’un même adapter Kysely implémente toutes les
opérations utilisateur et qu’un même adapter Redis implémente toutes les
opérations de session.

Un nouveau port ne doit être introduit que lorsqu’une responsabilité évolue
réellement séparément, par exemple :

- utilisation d’un stockage ou d’un read model différent ;
- implémentations disponibles avec des capacités différentes ;
- groupe d’opérations volumineux ou soumis à un autre cycle d’évolution ;
- contrat de lecture administratif ne retournant plus des entités du domaine.

La composition des capacités doit alors être explicite, sans utiliser un nom de
port comme mécanisme d’autorisation.

## Plan d’implémentation par couche

### Application IAM

1. Définir les critères de recherche, la pagination et le résultat paginé.
2. Ajouter les paramètres facultatifs à `ListUsersInput`.
3. Remplacer le tableau de `ListUsersOutput` par un résultat nommé contenant
   `users` et `pagination`.
4. Valider et normaliser les bornes au niveau approprié sans dépendre de HTTP.
5. Remplacer `findAll()` par la requête bornée du repository.
6. Ajouter `GetUserAdministrationOverviewUseCase`.
7. Conserver l’autorisation administrateur dans les deux cas d’usage.
8. Simplifier les types de repository et leurs exports publics.
9. Adapter `createIam`, ses dépendances et ses tests de composition.

### Persistance Kysely

1. Construire une requête à partir des seuls critères présents.
2. Appliquer les filtres avant le comptage et la pagination.
3. Exécuter une requête de comptage et une requête de sélection bornée.
4. Appliquer l’ordre déterministe `created_at DESC, id DESC`.
5. Mapper uniquement les lignes de la page en entités.
6. Ajouter une requête d’agrégation pour les indicateurs globaux.
7. Examiner les plans de requête avec un volume représentatif.
8. N’ajouter des index supplémentaires que s’ils sont justifiés par ces
   mesures, notamment pour la recherche partielle.

Le projet ne doit pas introduire une migration uniquement par anticipation. Si
un index devient nécessaire, la stratégie de migration doit respecter l’état
préproduction et la politique de schéma en vigueur au moment de
l’implémentation.

### API Fastify

1. Définir un schéma TypeBox pour les paramètres de requête.
2. Borner `search`, `page` et `pageSize` dans ce schéma.
3. Transmettre les critères validés au cas d’usage.
4. Adapter le presenter et le schéma de succès à l’enveloppe
   `{ data, meta: { pagination } }`.
5. Ajouter la route statique des indicateurs administratifs.
6. Documenter les paramètres et réponses dans Swagger.
7. Conserver les erreurs d’autorisation existantes et ajouter des erreurs
   stables uniquement si la validation applicative en nécessite.

Le passage d’un tableau à un objet paginé est une rupture du contrat HTTP.
L’API et l’application web doivent donc être livrées ensemble. Aucun double
format historique n’est demandé avant la mise en production.

### Application React

1. Définir les types des critères, de la pagination et des indicateurs.
2. Construire les paramètres de requête avec `URLSearchParams`.
3. Inclure page, taille et filtres dans la clé React Query.
4. Remplacer le filtrage intégral en mémoire par les résultats serveur.
5. Conserver uniquement les transformations de présentation côté client.
6. Ajouter les contrôles de pagination et leurs états accessibles.
7. Charger les indicateurs via une requête séparée.
8. Invalider liste et indicateurs après activation, suspension ou changement de
   rôle.
9. Adapter la sélection et le panneau de détail aux changements de page.
10. Ajouter ou adapter les traductions françaises et anglaises.

### Sessions

Les listes de sessions utilisateur et administrateur restent non paginées dans
cette spécification, à condition que le nombre de sessions actives par
utilisateur soit borné par une règle métier.

Si aucune borne n’existe, l’implémentation doit la définir ou ouvrir une
spécification séparée avant de considérer ce point comme durable. La pagination
des utilisateurs ne doit pas être généralisée mécaniquement à toutes les
collections.

## Scénarios de test

Les tests doivent couvrir au minimum :

1. refus de la liste pour un acteur non administrateur ;
2. première page avec les valeurs par défaut ;
3. page suivante sans doublon dans un jeu de données stable ;
4. ordre stable lorsque deux comptes ont la même date de création ;
5. page valide située après le dernier résultat ;
6. refus d’une page nulle, négative ou non entière ;
7. refus d’une taille supérieure au maximum ;
8. recherche d’adresse e-mail insensible à la casse ;
9. recherche partielle par identifiant ;
10. combinaison de la recherche, du rôle, du statut et de la vérification ;
11. total calculé après application des filtres ;
12. statistiques globales indépendantes de la page et des filtres ;
13. absence de données sensibles dans les réponses ;
14. traduction correcte des nouveaux états de l’interface ;
15. retour à la première page après modification d’un filtre ;
16. invalidation de la liste et des indicateurs après une mutation ;
17. adaptation du client au nouveau format de réponse ;
18. présence de la collection dans `data` et de la pagination dans
    `meta.pagination` ;
19. absence d’un objet `meta` vide sur les réponses sans métadonnée ;
20. présence des statistiques séparées dans `data` ;
21. compatibilité des adapters et fixtures avec les repositories simplifiés.

Les tests doivent être répartis selon les responsabilités existantes :

- tests unitaires des cas d’usage et de leurs règles ;
- tests de l’adapter Kysely pour les requêtes et le mapping ;
- tests de contrat, controller et presenter HTTP ;
- tests de l’interface React pour les interactions principales ;
- test de composition de l’application IAM.

## Critères d’acceptation

La fonctionnalité est terminée lorsque :

- aucun appel de liste ne retourne tous les utilisateurs sans borne ;
- la recherche et les filtres sont exécutés côté serveur ;
- la page par défaut contient au maximum 25 utilisateurs ;
- aucune page ne peut dépasser 100 utilisateurs ;
- le résultat applicatif utilise les noms métier `users` et `pagination` ;
- la réponse HTTP place la collection dans `data` et la pagination dans
  `meta.pagination` ;
- le bounded context ne dépend pas de la convention HTTP `data` et `meta` ;
- le total reflète les critères courants ;
- l’ordre est déterministe ;
- les indicateurs globaux restent exacts quelle que soit la page affichée ;
- les permissions administratives existantes sont préservées ;
- le client ne filtre plus une collection complète en mémoire ;
- les mutations rafraîchissent les données concernées ;
- Swagger décrit les nouveaux paramètres et formats ;
- les contrats application, API et web sont synchronisés ;
- les ports étendus sans frontière technique réelle ont été simplifiés ;
- les scénarios essentiels sont couverts par des tests ;
- la documentation HTTP et d’architecture concernée est mise à jour.

## Hors périmètre

Cette spécification n’inclut pas :

- la recherche approximative ou plein texte avancée ;
- le tri libre par toutes les colonnes ;
- l’export complet des utilisateurs ;
- la sélection et l’action en masse ;
- une pagination par curseur ;
- un moteur de recherche externe ;
- la pagination automatique de toutes les autres collections ;
- une séparation CQRS complète ;
- la création d’un port distinct pour chaque méthode de repository.
