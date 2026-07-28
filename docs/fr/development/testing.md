# Tests et vérifications

## Stratégie

Les tests sont colocalisés avec le code et exécutés par Vitest.

- Foundation teste les primitives de domaine.
- IAM core teste entités, objets-valeur, cas d’utilisation et factory.
- Chaque adaptateur teste sa conformité comportementale et ses conversions.
- L’API teste les helpers et les contrôleurs qui portent une règle d’accès ou
  une adaptation non triviale.
- Le web contient des tests unitaires ciblés ; il n’existe pas de suite E2E
  déclarée dans le dépôt.

Un cas d’utilisation **DOIT** être testé sans infrastructure réelle au moyen de
doubles conformes à ses ports. Un adaptateur **DEVRAIT** tester les spécificités
de la technologie et les données invalides. Une modification de contrat HTTP
**DEVRAIT** avoir un test au niveau de l’API lorsque le mapping ou
l’autorisation n’est pas trivial.

## Commandes racine

```bash
pnpm build
pnpm typecheck
pnpm typecheck:test
pnpm lint
pnpm test
pnpm test:coverage
pnpm format:check
```

Les scripts racine parcourent les workspaces avec `--if-present`. Pour une
boucle courte :

```bash
pnpm --filter @architecture/iam test
pnpm --filter api test
pnpm --filter web test
```

Le nom du package cœur est `@architecture/iam`, pas
`@architecture/iam-core`.

## Vérification proportionnée

Pour un changement de documentation uniquement :

1. exécuter le vérificateur de liens et de chemins décrit ci-dessous ;
2. exécuter `pnpm format:check` ou Prettier sur les documents modifiés ;
3. exécuter `git diff --check`.

Pour un changement métier :

1. tests du package cœur ;
2. `typecheck` et `typecheck:test` des packages concernés ;
3. tests des adaptateurs touchés ;
4. tests, lint et build des applications consommatrices ;
5. suite racine si un port ou un export public change.

## Vérifier les liens Markdown

Le dépôt ne fournit pas encore de script dédié. Un contrôle local doit :

- ignorer les URL externes et les ancres seules ;
- résoudre chaque lien relatif depuis son document ;
- retirer l’ancre et décoder les chemins avant de tester leur existence ;
- vérifier séparément les ancres si leur validité est critique.

Cette absence d’automatisation est une recommandation d’amélioration, pas une
garantie actuelle.

## Couverture

Vitest utilise V8 et produit `text`, `html` et `lcov` dans le dossier
`coverage` de chaque package. Aucun seuil minimal global n’est configuré ; une
hausse ou une baisse de pourcentage ne remplace donc pas la vérification des
comportements métier importants.
