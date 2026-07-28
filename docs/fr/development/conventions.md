# Conventions de développement

## Nommage et organisation

- Les fichiers TypeScript utilisent le kebab-case et un suffixe de rôle :
  `sign-in.use-case.ts`, `user.entity.ts`, `redis-session.adapter.ts`.
- Les classes utilisent le PascalCase ; fonctions et propriétés, le camelCase.
- Un cas d’utilisation expose un contrat `Nom`, des types `NomInput`,
  `NomOutput`, éventuellement `NomError`, et une classe `NomUseCase`.
- Une implémentation technique se termine par `Adapter` et nomme sa technologie.
- Les tests sont colocalisés sous la forme `*.spec.ts` ou `*.spec.tsx`.
- Une fonctionnalité HTTP Identity possède son dossier sous
  `apps/api/src/features/identity/<feature>`.

## Contrats et résultats

Les erreurs métier attendues **DOIVENT** être représentées par des objets
portant un `code` stable et retournées dans `Result<TValue, TError>`. Les
contrats applicatifs ne portent pas de statut HTTP. La couche API associe ces
codes à un contrat de transport dans `*.http.ts`, puis le presenter transforme
le résultat.

```ts
export interface SignIn {
  execute(input: SignInInput): Promise<SignInOutput>;
}
```

Une erreur inattendue de base, de cache ou de programmation **NE DOIT PAS** être
convertie arbitrairement en erreur métier. Elle remonte au gestionnaire global
de l’API, sauf stratégie explicite propre à l’adaptateur.

Les succès n’ont pas de catalogue global : chaque contrat HTTP définit ses
succès. Une modification de code, statut ou forme de réponse **DOIT** être
répercutée dans le schéma TypeBox et dans le client web concerné.

## Objets de domaine

- Une valeur venant de l’extérieur **DOIT** passer par la factory de
  l’objet-valeur.
- `create` **DOIT** établir les invariants d’un nouvel objet.
- `rehydrate` **DOIT** être réservé à la restauration d’un état persisté.
- Les transitions métier **DEVRAIENT** être des méthodes d’entité, pas des
  mutations opérées par un contrôleur ou un adaptateur.
- Les primitives ne **DOIVENT PAS** remplacer les objets-valeur dans les ports
  lorsqu’une sémantique métier existe déjà.

## Imports et exports

L’API publique d’un package **DOIT** être volontaire et déclarée par ses
fichiers d’index et son champ `exports`. Les consommateurs utilisent
`@architecture/identity/application` ou `/domain`, jamais un chemin interne.

Dans un package, préférer ses alias `#...`. Les nouveaux alias **DOIVENT** être
déclarés dans `package.json` et rester compatibles avec TypeScript et la sortie
ESM. Les imports de type **DEVRAIENT** utiliser `import type`.

## Types optionnels

Le projet active des contraintes TypeScript strictes, notamment
`exactOptionalPropertyTypes` dans les packages concernés. Pour une propriété
optionnelle, omettre la clé plutôt que fournir explicitement `undefined` :

```ts
return {
  userId,
  ...(client ? { client } : {}),
};
```

## Interface HTTP

- Les routes publiques, authentifiées et administrateur restent séparées.
- Une route possédée par l’utilisateur **DOIT** dériver `userId` de
  `request.auth` et **NE DOIT PAS** accepter l’identifiant d’un autre utilisateur.
- Un contrôleur protégé **DOIT** gérer l’absence d’authentification, même si un
  hook la précède.
- Les schémas TypeBox décrivent corps, paramètres, query et réponses.
- Les cookies de session restent `httpOnly`; leur politique `sameSite` et
  `secure` est centralisée dans `buildSessionCookieOptions`.

## Commits et documentation

Les commits suivent Conventional Commits, contrôlé par Commitlint. Un changement
**DEVRAIT** former une unité cohérente (`feat(identity): ...`,
`docs(architecture): ...`). Les lignes de message restent courtes.

Toute décision structurante durable **DEVRAIT** être documentée dans le registre
d’ADR. Un changement de règle ou de navigation documentaire **DOIT** mettre à
jour les éditions française et anglaise.

## Versionnage

Les versions alpha visibles dans les manifestes ne constituent pas une
politique de publication. En l’absence d’automatisation ou d’ADR, ne pas
affirmer que Semantic Release, un versionnage indépendant ou une garantie SemVer
inter-packages est en vigueur.
