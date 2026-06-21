# CQRS (Command Query Responsibility Segregation)

## 1. Définition

CQRS est un pattern architectural qui consiste à séparer :

- **Commands** → opérations qui modifient l’état (WRITE)
- **Queries** → opérations qui lisent des données (READ)

---

## 2. Principe fondamental

> Une méthode qui modifie l’état ne doit pas retourner de données de lecture.
> Une méthode qui lit des données ne doit pas modifier l’état.

---

## 3. Structure logique

Application Layer
├── commands/ → écritures (mutations)
└── queries/ → lectures (read-only)

---

## 4. Commands

### Définition

Une Command représente une intention d’exécuter une action métier.

### Exemple

type RegisterCommand = {
email: string;
password: string;
};

### Rôle

- déclenche un use case
- modifie l’état du système
- retourne un résultat métier minimal

---

## 5. Queries

### Définition

Une Query représente une demande de lecture de données.

### Exemple

type GetUserQuery = {
userId: string;
};

### Rôle

- ne modifie jamais l’état
- retourne des DTO de lecture
- optimisé pour lecture

---

## 6. Différence clé

| Aspect        | Command      | Query               |
| ------------- | ------------ | ------------------- |
| Action        | Write        | Read                |
| Effet de bord | Oui          | Non                 |
| Retour        | état minimal | données structurées |
| Exemple       | RegisterUser | GetUserById         |

---

## 7. Exemple complet

### Command

register.execute({
email: "test@mail.com",
password: "1234",
});

Retour :
{ userId: "123" }

---

### Query

getUser.execute({
userId: "123",
});

Retour :
{
id: "123",
email: "test@mail.com"
}

---

## 8. Avantages

- Clarté métier
- Séparation des responsabilités
- Scalabilité
- Testabilité

---

## 9. Inconvénients

- plus de fichiers
- surkill pour petits projets

---

## 10. Conclusion

CQRS est un outil pour clarifier les intentions et séparer lecture et écriture.
