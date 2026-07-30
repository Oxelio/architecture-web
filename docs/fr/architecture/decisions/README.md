# Décisions architecturales

Ce registre consigne uniquement les décisions démontrées par le code actuel.
Une décision future **DEVRAIT** être ajoutée dans un fichier
`NNNN-titre-court.md` avec contexte, options, décision, conséquences et statut.

Les agrégats et leurs frontières de cohérence sont détaillés dans
[ADR-0004](0004-aggregates-and-consistency.md).
Les Domain Events, l’outbox et les échanges avec Audit et Notifications sont
détaillés dans [ADR-0005](0005-domain-events-messaging.md).

## ADR-0001 — Cœur IAM indépendant des technologies

**Statut : acceptée**

### Contexte

Les règles d’identité doivent rester stables lorsque PostgreSQL, Redis, le
hachage ou l’envoi d’e-mail évoluent.

### Options observables

- appeler les bibliothèques techniques dans les cas d’utilisation ;
- définir des ports dans l’application et les implémenter en infrastructure.

### Décision

Les cas d’utilisation dépendent de classes abstraites applicatives. Les
packages d’infrastructure les implémentent et l’API choisit les adaptateurs.

### Conséquences

Le cœur est testable en isolation et plusieurs implémentations peuvent
coexister. En contrepartie, tout changement de port doit être synchronisé avec
ses adaptateurs et doubles de test.

## ADR-0002 — Monorepo pnpm à packages spécialisés

**Statut : acceptée de fait**

### Contexte

Le dépôt contient deux applications et plusieurs implémentations interchangeables.

### Décision

Le workspace `apps/*` et `packages/**` sépare les applications privées, le cœur
IAM, Foundation, l’outillage ESLint et chaque technologie
d’infrastructure.

### Conséquences

Les frontières sont visibles dans les manifestes et les exports. Le nombre de
packages augmente, et les changements de contrat exigent des validations
transverses. Aucune politique de publication indépendante n’est établie.

## ADR-0003 — Composition manuelle dans l’API

**Statut : acceptée**

### Contexte

Un seul endroit doit connaître simultanément les ports et leurs implémentations.

### Options observables

- conteneur d’injection externe ;
- singleton implicite ;
- composition explicite.

### Décision

`apps/api/src/composition-root` crée PostgreSQL et Redis, instancie les
adaptateurs, appelle `createIam` et expose une méthode `dispose`.

### Conséquences

Le graphe au démarrage est lisible et sans magie de framework. Modifier une
technologie exige de changer la composition, ce qui est précisément le point
d’extension prévu.

## Questions non tranchées

- publication ou non des packages en dehors du monorepo ;
- versionnage commun ou indépendant ;
- durcissement automatique des règles de dépendance ;
- correction du chemin historique `persitence`.
- maintien de `SecurityService` dans l’API ou extraction vers des cas
  d’utilisation et adaptateurs dédiés ;
- stratégie de planification de la maintenance de sécurité.

Ces sujets ne doivent pas être présentés comme décidés avant une modification
explicite du code ou un nouvel ADR.
