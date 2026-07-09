# Conventions et règles de développement

## Organisation du code

Le code est organisé autour de responsabilités claires :

- les routes et contrôleurs vivent dans l’application web,
- les cas d’usage vivent dans le bounded context,
- les entités et objets de valeur vivent dans le domaine,
- les implémentations techniques vivent dans l’infrastructure.

## Conventions de nommage

- les fichiers utilisent des noms descriptifs en minuscules et en kebab-case,
- les classes de domaine portent des noms métier,
- les cas d’usage portent le suffixe “UseCase”,
- les adaptateurs portent un nom reflétant la technologie concernée.

## Règles d’architecture

- le domaine ne dépend pas de l’infrastructure,
- les cas d’usage ne doivent pas connaître les détails de la base de données ou du framework web,
- les dépendances externes doivent passer par des ports et des adaptateurs,
- les erreurs métier doivent être explicites et non cachées par des exceptions génériques.

## Gestion des erreurs

Les erreurs doivent être traitées à la bonne couche :

- les erreurs métier remontent jusqu’aux use cases,
- la couche HTTP transforme ces erreurs en réponses cohérentes,
- les détails techniques ne doivent pas s’échapper vers le domaine.

## Stratégie de test

Le projet contient déjà des tests au niveau des use cases. Les tests doivent privilégier :

- la validation des règles métier,
- l’isolation des dépendances via des doubles ou des ports,
- la vérification du comportement observable du cas d’usage.

## Processus de contribution

Lorsqu’une fonctionnalité est ajoutée :

1. identifier le bounded context concerné,
2. ajouter ou modifier les cas d’usage concernés,
3. préserver la séparation des responsabilités,
4. adapter l’API si nécessaire,
5. ajouter des tests ciblés.
