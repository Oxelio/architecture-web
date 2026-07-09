# Vue d’ensemble

## Présentation du projet

Ce projet est une application web de référence orientée autour de la gestion d’identité et d’authentification. Il illustre une architecture modulaire où le cœur métier est séparé des mécanismes techniques externes tels que la base de données, la session, le hachage de mot de passe et l’envoi d’e-mails.

## Objectifs

Le système a été conçu pour montrer comment construire une application robuste en séparant clairement :

- la logique métier,
- les cas d’usage applicatifs,
- l’API web,
- les adaptateurs infrastructure.

Cette séparation permet de conserver les règles métier au centre du système et d’isoler les dépendances externes.

## Problèmes résolus

Le projet répond à plusieurs préoccupations architecturales classiques :

- éviter de mélanger logique métier et code d’infrastructure,
- rendre les cas d’usage testables sans dépendre d’un framework web,
- permettre de remplacer facilement une implémentation technique sans changer le cœur du domaine,
- clarifier les responsabilités entre le transport HTTP et la logique applicative.

## Philosophie générale

Le principe central est le suivant : le domaine ne doit pas dépendre de détails techniques. Les cas d’usage connaissent des abstractions, pas des implémentations concrètes. Cela signifie que les règles métier restent stables même si la base de données, le système de cache ou la bibliothèque d’email change.

## Principes directeurs

- La logique métier appartient au domaine.
- Les cas d’usage orchestrent des actions métier de manière claire.
- Les infrastructures sont implémentées via des adaptateurs.
- L’API ne fait que transporter des requêtes et des réponses.
- Les erreurs métier sont explicitement modélisées.
- Les dépendances externes sont injectées au point d’entrée du système.

## Décisions majeures

Le projet privilégie une approche de type hexagonale, avec un bounded context dédié à l’identité. Cette décision permet de limiter la complexité et de rendre le contexte autonome tout en restant composable.
