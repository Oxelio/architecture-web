# Spécifications fonctionnelles

Les spécifications fonctionnelles décrivent le comportement attendu du point de
vue métier et utilisateur. Elles définissent le besoin, les acteurs, les règles,
les cas particuliers et les critères d’acceptation sans remplacer la
documentation d’architecture ni les tests exécutables.

## Cycle de vie

Chaque spécification utilise l’un de ces statuts :

- **Brouillon** : en discussion et pas encore acceptée ;
- **Acceptée** : validée, mais pas nécessairement implémentée ;
- **Implémentée** : reflétée par l’application actuelle ;
- **Remplacée** : supplantée par une autre spécification nommée.

Un changement de statut **DOIT** être justifié par l’état actuel du projet. Les
détails techniques appartiennent à la documentation d’architecture et doivent
être reliés plutôt que dupliqués.

## Catalogue

| Identifiant                           | Statut      | Sujet                                                                      |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| [SF-SESSION-001](SF-SESSION-001.md)   | Implémentée | Enrichissement des sessions actives avec des informations d’identification |
| [SF-PASSWORD-001](SF-PASSWORD-001.md) | Implémentée | Politique configurable de mots de passe sécurisés                          |
