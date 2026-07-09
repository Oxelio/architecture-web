# Documentation IA

## Contexte du projet

Ce dépôt illustre une architecture modulaire autour de l’identité. Le but n’est pas seulement d’implémenter des routes d’authentification, mais de préserver une séparation nette entre les responsabilités métier et techniques.

## Modèle mental du projet

Lorsque vous modifiez ce projet, pensez en termes de couches :

- domaine : règles métier et entités,
- application : orchestration des cas d’usage,
- infrastructure : implémentations techniques,
- API : adaptation au protocole HTTP.

## Règles de modification du code

Les modifications doivent respecter les invariants suivants :

- ne pas introduire de logique métier dans l’API,
- ne pas faire dépendre le domaine de Redis, PostgreSQL ou Fastify,
- conserver les frontières entre ports et adaptateurs,
- éviter les changements qui brouillent les responsabilités entre couches.

## Instructions de génération de code

Les nouvelles fonctionnalités doivent :

- suivre les conventions de nommage déjà observées,
- utiliser des cas d’usage pour l’orchestration,
- garder les entités et objets de valeur au cœur du domaine,
- exposer les dépendances externes via des abstractions.

## Cartographie du projet

- [apps/api](../../apps/api) : point d’entrée HTTP et composition root.
- [bounded-contexts/identity](../../bounded-contexts/identity) : logique métier liée à l’identité.
- [foundation](../../foundation) : abstractions de base du domaine.
- [infrastructure](../../infrastructure) : implémentations techniques concrètes.
