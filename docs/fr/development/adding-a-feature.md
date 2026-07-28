# Ajouter une fonctionnalité

Ce parcours part d’une intention métier et se termine à l’interface. Toutes les
étapes ne sont pas nécessaires : ne créer un port ou un objet de domaine que si
la fonctionnalité le justifie réellement.

## 1. Définir le comportement

Identifier :

- l’acteur et son niveau d’accès ;
- l’entrée métier, le résultat et les erreurs attendues ;
- les invariants portés par une entité ou un objet-valeur ;
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

Exporter le type depuis `packages/identity/core/domain/index.ts` seulement s’il
fait partie du contrat public. Ajouter un test colocalisé couvrant validation,
égalité et limites pertinentes.

## 3. Définir le contrat applicatif

Créer sous `application/use-cases/<feature>` :

- `<feature>.codes.ts` pour les codes stables ;
- `<feature>.contracts.ts` pour entrée, sortie et interface ;
- `<feature>.use-case.ts` pour l’orchestration ;
- `<feature>.use-case.spec.ts` pour le comportement.

Le cas d’utilisation **DOIT** dépendre de ports, jamais d’adaptateurs.

## 4. Ajouter ou étendre un port

Placer un repository dans `application/repositories` et un service externe dans
`application/services`. Préférer un port minimal guidé par les besoins du cas
d’utilisation.

```ts
export abstract class ExampleRepository {
  abstract save(entity: ExampleEntity): Promise<void>;
}
```

Exporter le port depuis `application/index.ts`. Si un port existant change,
mettre à jour dans le même changement tous ses adaptateurs, la composition et
les doubles de test.

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

Ajouter la dépendance à `IdentityDependencies`, construire le cas d’utilisation
dans `createIdentity`, l’exposer dans `IdentityApplication`, puis choisir
l’adaptateur dans `apps/api/src/composition-root/identity.module.ts`.

## 7. Exposer le contrat HTTP

Créer `apps/api/src/features/identity/<feature>` avec :

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

Mettre à jour la référence HTTP si un endpoint est ajouté, et créer un ADR
uniquement si une décision structurante durable a été prise.

## 9. Valider

Exécuter au minimum les tests et typechecks des unités modifiées. Pour un
nouveau port ou export public, exécuter la validation du workspace complet et
rechercher les imports internes qui contourneraient la nouvelle API.
