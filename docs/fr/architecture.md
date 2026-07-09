# Architecture

## Vue d’ensemble architecturale

Le projet repose sur une séparation claire entre plusieurs couches :

- une couche d’API web,
- une couche applicative,
- un bounded context métier,
- et des couches d’infrastructure.

Cette structure a été choisie pour éviter que le code ne devienne rapidement difficile à maintenir lorsque le nombre de fonctionnalités augmente.

## Composants principaux

### 1. API application

Le dossier [apps/api](../..//apps/api) contient l’entrée réseau du système. Il est responsable de :

- créer le serveur HTTP,
- enregistrer les routes,
- transformer les requêtes HTTP en appels de cas d’usage,
- formater les réponses pour le client.

L’API ne contient pas la logique métier elle-même. Son rôle est de transporter les intentions utilisateur vers les cas d’usage du bounded context.

### 2. Bounded context identity

Le dossier [bounded-contexts/identity](../..//bounded-contexts/identity) contient la logique métier relative à l’identité : inscriptions, connexion, vérification d’email, changement d’email, changement de mot de passe, activation ou suspension d’utilisateur.

Cette zone est volontairement isolée pour exprimer un domaine métier cohérent et indépendant des détails techniques.

### 3. Foundation

Le package [foundation](../..//foundation) fournit des abstractions de base utilisées par le domaine : entités, objets de valeur et résultats. Ces abstractions sont intentionally simples afin de ne pas imposer un framework ou une bibliothèque spécifique.

### 4. Infrastructure

Les packages d’infrastructure fournissent des adaptateurs concrets pour :

- la persistance avec Kysely,
- la session avec Redis,
- le hachage des mots de passe avec Argon2 ou bcrypt,
- l’envoi d’e-mails avec un service externe.

L’objectif est de rendre les dépendances externes remplaçables sans modifier le cœur du système.

## Pourquoi cette structure

Cette organisation répond à plusieurs besoins :

- préserver les règles métier au centre du système,
- limiter l’impact des changements techniques sur le domaine,
- simplifier les tests,
- rendre les composants interchangeables.

## Flux de dépendances

Le flux typique est le suivant :

1. une requête HTTP arrive dans l’API ;
2. le contrôleur délègue au cas d’usage ;
3. le cas d’usage utilise des objets de domaine et des ports ;
4. les ports sont implémentés par des adaptateurs infrastructure ;
5. le résultat est renvoyé au client via un presenter ou une réponse HTTP.

## Frontières architecturales

Les frontières principales sont les suivantes :

- entre l’API et l’application,
- entre l’application et le domaine,
- entre le domaine et l’infrastructure.

Ces frontières sont importantes car elles empêchent les détails techniques de contaminer la logique métier.

## Choix techniques et compromis

### Séparation domaine / infrastructure

Ce choix résout le problème du couplage fort aux bases de données, moteurs de cache ou services externes. Le compromis est une légère augmentation de la complexité initiale, compensée par une meilleure maintenabilité.

### Injection de dépendances via composition root

Le point d’entrée de l’API construit les dépendances et les injecte aux cas d’usage. Cela rend l’application plus claire et plus facile à tester. Le compromis est que la configuration initiale du système est un peu plus explicite.

### Bounded context dédié à l’identité

Cette séparation permet de traiter l’identité comme un domaine autonome. Le compromis est qu’il faut maintenir des frontières claires pour éviter que d’autres fonctionnalités n’envahissent ce contexte.
