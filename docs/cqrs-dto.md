# CQRS (Command Query Responsibility Segregation)

## 1. Définition

CQRS est un pattern architectural qui consiste à séparer :

- **Commands** → opérations qui modifient l’état (WRITE)
- **Queries** → opérations qui lisent des données (READ)

---

## 2. Principe fondamental

> Une opération qui modifie l’état ne doit pas être utilisée comme mécanisme de lecture.
>
> Une opération de lecture ne doit pas modifier l’état du système.

---

## 3. Structure logique

```text
Application Layer
├── commands/
└── queries/
```

---

## 4. Commands

### Définition

Une Command représente une intention métier de modifier l’état du système.

### Exemple

```ts
type RegisterUserCommand = {
  email: string;
  password: string;
};
```

### Rôle

- déclenche un use case
- modifie l’état du système
- retourne un résultat minimal nécessaire à la suite du traitement

### Exemple

```ts
const result = await register.execute({
  email: "john@doe.com",
  password: "secret",
});
```

Retour :

```ts
{
  userId: "123";
}
```

---

## 5. Queries

### Définition

Une Query représente une demande de lecture.

### Exemple

```ts
type GetUserQuery = {
  userId: string;
};
```

### Rôle

- ne modifie jamais l’état
- retourne des données de lecture
- peut être optimisée indépendamment des Commands

### Exemple

```ts
const user = await getUser.execute({
  userId: "123",
});
```

Retour :

```ts
{
  id: "123",
  email: "john@doe.com"
}
```

---

## 6. DTO et CQRS

### Définition d'un DTO

DTO signifie **Data Transfer Object**.

Un DTO est un objet dont le seul rôle est de transporter des données entre deux couches.

Un DTO ne contient pas :

- de logique métier
- de validation métier complexe
- de comportement

---

### Command = DTO d'entrée

Dans la plupart des architectures CQRS :

```ts
export interface RegisterUserCommand {
  email: string;
  password: string;
}
```

est déjà un DTO.

La Command représente :

- l'intention métier
- le contrat d'entrée du use case

---

### Query = DTO d'entrée

```ts
export interface GetUserQuery {
  userId: string;
}
```

est également un DTO.

---

### DTO de sortie

Les Queries retournent généralement des DTO de lecture :

```ts
type UserDto = {
  id: string;
  email: string;
};
```

Ces objets sont optimisés pour l'affichage et non pour le métier.

---

## 7. Entités, Value Objects et DTO

### DTO

```ts
{
  email: "john@doe.com",
  password: "secret"
}
```

Transport de données uniquement.

---

### Value Object

```ts
const email = Email.of(command.email);
```

Garantit les règles métier associées à une valeur.

---

### Entité

```ts
const user = User.create({
  email,
  password,
});
```

Représente un objet métier possédant une identité.

---

## 8. Retour d'une Command

Une Command ne doit pas devenir une Query.

Bon exemple :

```ts
Result<{ userId: string }, RegisterError>;
```

La Command retourne uniquement ce qui est nécessaire pour poursuivre le flux applicatif.

Mauvais exemple :

```ts
{
  id: "123",
  email: "john@doe.com",
  createdAt: "...",
  roles: [...]
}
```

Ce type de données devrait généralement être obtenu via une Query dédiée.

---

## 9. Structure recommandée

```text
register-user/
├── register-user.command.ts
├── register-user.result.ts
└── register-user.use-case.ts

get-user/
├── get-user.query.ts
├── get-user.result.ts
└── get-user.use-case.ts
```

---

## 10. Avantages

- séparation claire lecture / écriture
- meilleure testabilité
- meilleure évolutivité
- responsabilités explicites
- contrats applicatifs simples

---

## 11. Inconvénients

- plus de fichiers
- complexité supplémentaire pour les petits projets
- nécessite une discipline architecturale

---

## 12. Conclusion

Dans une architecture CQRS :

- une Command est généralement un DTO d'entrée orienté écriture
- une Query est généralement un DTO d'entrée orienté lecture
- les Value Objects et Entités appartiennent au domaine
- les DTO servent uniquement au transport des données
- les Commands doivent retourner un résultat minimal et non des données de lecture complètes
