# Decisions architecturales importantes (ADR)

## ADR-001 — Séparation claire entre domaine et infrastructure

### Statut

Acceptée

### Contexte

Le projet doit rester compréhensible même si les dépendances techniques évoluent. Une logique métier directement couplée à Redis, PostgreSQL ou Fastify serait difficile à maintenir.

### Décision

Le domaine et les use cases sont isolés des détails techniques via des ports et des adaptateurs.

### Conséquence

Le cœur fonctionnel devient plus stable et plus testable, au prix d’une structure un peu plus explicite.

## ADR-002 — Bounded context dédié à l’identité

### Statut

Acceptée

### Contexte

L’authentification et la gestion des utilisateurs forment un domaine cohérent, mais suffisamment autonome pour justifier une frontière claire.

### Décision

Le code relatif à l’identité est regroupé dans un bounded context distinct.

### Conséquence

Les responsabilités sont plus claires et l’évolution du domaine est plus maîtrisée.

## ADR-003 — Composition root au niveau de l’API

### Statut

Acceptée

### Contexte

Les dépendances doivent être assemblées à un endroit clair pour éviter une configuration dispersée.

### Décision

L’API construit les dépendances et les injecte dans les cas d’usage.

### Conséquence

Le système est plus explicite, plus facile à tester, et plus simple à faire évoluer.
