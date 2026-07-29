# Ajouter une fonctionnalité

Ce parcours part d’une intention métier et se termine à l’interface. Toutes les
étapes ne sont pas nécessaires : ne créer un port ou un objet de domaine que si
la fonctionnalité le justifie réellement.

Ce parcours décrit la structure privilégiée de `packages/iam/core` et
`apps/api/src/features/iam`. La verticale existante
`apps/api/src/security` est une exception hybride documentée dans le
[guide de sécurité](../guides/account-security.md) ; elle ne **DOIT PAS** être
utilisée comme modèle implicite pour une nouvelle capacité.

## 1. Définir le comportement

Identifier :

- l’acteur et son niveau d’accès ;
- l’entrée métier, le résultat et les erreurs attendues ;
- les invariants portés par une entité ou un objet-valeur ;
- la racine d’agrégat qui protège chaque invariant et la frontière
  transactionnelle nécessaire ;
- les effets externes nécessaires ;
- les changements cassants éventuels.

Ne pas commencer par la route HTTP : le contrat applicatif doit rester
utilisable depuis une autre interface.

## 2. Étendre le domaine si nécessaire

Un nouvel objet-valeur suit les factories existantes :

```ts
export class ExampleValueObject extends ValueObject<{ value: string }> {
  static create(value: string): Result<ExampleValueObject, ExampleError> {
    if (!isValid(value)) {
      return Result.failure({ code: "example.invalid" });
    }
    return Result.success(new ExampleValueObject({ value }));
  }

  get value(): string {
    return this.properties.value;
  }
}
```

Exporter le type depuis `packages/iam/core/domain/index.ts` seulement s’il
fait partie du contrat public. Ajouter un test colocalisé couvrant validation,
égalité et limites pertinentes.

## 3. Définir le contrat applicatif

Choisir d’abord `accounts`, `authentication` ou `access-administration`, puis
créer sous `application/<capacité>/use-cases/<feature>` :

- `<feature>.codes.ts` pour les codes stables ;
- `<feature>.contracts.ts` pour entrée, sortie et interface ;
- `<feature>.use-case.ts` pour l’orchestration ;
- `<feature>.use-case.spec.ts` pour le comportement.

Le cas d’utilisation **DOIT** dépendre de ports, jamais d’adaptateurs.

Le contrat applicatif emploie le langage métier. Une liste paginée nomme par
exemple `users` et `pagination`; les conventions de transport `data` et `meta`
restent dans le presenter HTTP.

## 4. Ajouter ou étendre un port

Placer un repository dans `application/repositories` et un service externe dans
`application/services`. Préférer un port cohérent guidé par les besoins du cas
d’utilisation. Ne pas créer un nouveau port pour une seule méthode lorsque le
même adapter et le même cycle d’évolution couvrent déjà cette responsabilité.

```ts
export abstract class ExampleRepository {
  abstract save(root: ExampleAggregateRoot): Promise<void>;
}
```

Exporter le port depuis `application/index.ts`. Si un port existant change,
mettre à jour dans le même changement tous ses adaptateurs, la composition et
les doubles de test.

Si une commande PostgreSQL modifie plusieurs agrégats, elle **DOIT** passer par
`IamUnitOfWork`. Une opération couvrant PostgreSQL et Redis **DOIT** rester
idempotente et définir le mécanisme qui détecte ou répare une exécution
partielle ; elle ne doit pas simuler une transaction distribuée.

## 5. Implémenter l’infrastructure

Choisir ou créer un package spécialisé. L’adaptateur déclare explicitement le
port :

```ts
export class TechnologyExampleAdapter implements ExampleRepository {
  async save(entity: ExampleEntity): Promise<void> {
    // conversion et appel technique
  }
}
```

Le package exporte uniquement les éléments nécessaires. Les migrations,
schémas et mappers évoluent ensemble lorsque la persistance change.

## 6. Composer le cas d’utilisation

Ajouter la dépendance à `IamDependencies`, construire le cas d’utilisation
dans `createIam`, l’exposer dans `IamApplication`, puis choisir
l’adaptateur dans `apps/api/src/composition-root/iam.module.ts`.

## 7. Exposer le contrat HTTP

Créer `apps/api/src/features/iam/<feature>` avec :

- contrôleur ;
- contrat HTTP ;
- presenter ;
- options de route TypeBox.

Ajouter le contrôleur à `compose-controllers.ts`, puis enregistrer la route dans
`public.routes.ts`, `protected.routes.ts` ou `admin.routes.ts`.

Pour une route utilisateur, dériver l’identité de `request.auth`. Pour une
route administrateur, garder le contrôle de rôle global et interdire les
opérations sur soi lorsque la règle métier l’exige.

## 8. Adapter le web et la documentation

Mettre à jour `apps/web/src/services/api.ts`, les hooks React Query, l’interface
et les traductions FR/EN. Les types de transport du web doivent correspondre
aux réponses sérialisées, pas aux classes du domaine.

Une requête paramétrée **DOIT** inclure tous ses critères dans sa clé React
Query. Une mutation **DOIT** invalider chaque ressource affectée : une
modification de rôle invalide par exemple la liste paginée et les indicateurs
globaux.

Mettre à jour la référence HTTP si un endpoint est ajouté, et créer un ADR
uniquement si une décision structurante durable a été prise.

Une nouvelle route **DOIT** recevoir des schémas TypeBox pour le corps, les
paramètres, la query et les réponses. Les routes de sécurité actuelles n’en ont
pas encore ; cette dette ne justifie pas d’ajouter une autre route non décrite.

## 9. Valider

Exécuter au minimum les tests et typechecks des unités modifiées. Pour un
nouveau port ou export public, exécuter la validation du workspace complet et
rechercher les imports internes qui contourneraient la nouvelle API.
