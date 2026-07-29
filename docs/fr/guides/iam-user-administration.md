# Administration des utilisateurs

Ce guide décrit la consultation administrative implémentée par
[SF-ADMIN-USERS-001](../specifications/SF-ADMIN-USERS-001.md). Il complète la
[référence HTTP](../reference/http-api.md), qui reste la source de vérité pour
les routes publiques avec les schémas TypeBox et Swagger.

## Frontière métier

La capacité `access-administration` distingue deux ressources :

- une liste recherchée, filtrée et paginée ;
- des indicateurs globaux indépendants de la page et des filtres.

`ListUsersUseCase` et `GetUserAdministrationOverviewUseCase` autorisent
l’acteur avec `AdministratorAuthorizer` avant d’interroger les lectures
administratives. L’acteur doit exister, être actif et posséder le rôle `admin`.
Le hook Fastify protège également le groupe de routes, mais il ne remplace pas
cette règle applicative.

Le résultat applicatif de liste emploie le langage IAM :

```text
ListUsersResult
├── users
└── pagination
    ├── page
    ├── pageSize
    ├── total
    └── totalPages
```

Les valeurs par défaut sont la page `1` et une taille de `25`. La taille
maximale est `100`. Le cas d’utilisation refuse les pages non entières ou
inférieures à `1`, ainsi que les tailles hors bornes. Une recherche vide après
suppression des espaces est omise.

## Port et persistance

`UserRepository` regroupe les opérations utilisateur tant que
`KyselyUserAdapter` les implémente toutes avec le même stockage et le même cycle
d’évolution. Il expose notamment :

- `search(criteria)` pour la lecture bornée ;
- `getAdministrationOverview()` pour l’agrégation globale.

`KyselyUserAdapter.search` applique les critères présents avec une logique
`ET`. Le terme de recherche correspond partiellement à l’adresse avec `ILIKE`
et à l’identifiant avec `LIKE`. Le comptage utilise les mêmes filtres que la
sélection.

La page est ordonnée par `created_at DESC`, puis `id DESC`, avant application de
`limit` et `offset`. L’adapter ne sélectionne et ne transforme en entités que
les lignes de la page. L’agrégation des nombres total, actifs, suspendus et
administrateurs est une requête distincte.

Aucune migration ni aucun index de recherche supplémentaire n’a été introduit.
Les tests actuels vérifient la construction des requêtes avec des doubles
Kysely ; une analyse `EXPLAIN` sur un volume représentatif reste nécessaire
avant de décider d’un index pour la recherche partielle.

## Transport HTTP

`GET /v1/iam/users` accepte `search`, `role`, `status`, `emailVerified`, `page`
et `pageSize`. Le presenter traduit le résultat métier vers la convention
publique :

```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

`GET /v1/iam/users/overview` retourne les indicateurs sous `data` sans objet
`meta`, car ils constituent une ressource distincte et non des métadonnées de
la page.

Les représentations administratives ne contiennent que l’identifiant,
l’adresse, le rôle, le statut, la vérification de l’adresse et les dates. Le
mot de passe haché et les autres détails internes ne franchissent pas cette
frontière.

## Client React

`AdminPage` conserve les critères et la page dans son état local. Chaque
critère fait partie de la clé React Query de la liste. La saisie de recherche
est temporisée de 300 millisecondes ; un changement de recherche ou de filtre
revient à la première page et ferme le détail sélectionné.

La liste et les indicateurs utilisent deux requêtes React Query séparées. Une
activation, une suspension ou un changement de rôle invalide les deux clés.
Les sessions de l’utilisateur sélectionné conservent leur propre clé.

L’interface distingue chargement initial, rafraîchissement, erreur et résultat
vide. Les boutons précédent et suivant sont désactivés lorsque la navigation
est impossible.

## Limites observées

- Les critères ne sont pas synchronisés avec l’URL ; recharger la page rétablit
  les valeurs initiales.
- La pagination par numéro repose sur `offset`. Une création ou modification
  concurrente entre deux requêtes peut donc déplacer une ligne, malgré l’ordre
  déterministe pour un jeu de données stable.
- Le dépôt ne contient pas de test d’intégration PostgreSQL ni de mesure de plan
  de requête pour cette consultation.

Ces limites sont des constats actuels, pas des comportements garantis ni des
décisions de remplacement.
