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

| Identifiant                                           | Statut      | Sujet                                                                      |
| ----------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| [SF-ACCOUNT-DATA-001](SF-ACCOUNT-DATA-001.md)         | Acceptée    | Export et suppression des données du compte                                |
| [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md) | Acceptée    | Récupération de compte et réinitialisation du mot de passe                 |
| [SF-ADMIN-USERS-001](SF-ADMIN-USERS-001.md)           | Implémentée | Recherche et pagination de l’administration des utilisateurs               |
| [SF-MFA-001](SF-MFA-001.md)                           | Acceptée    | Authentification multifacteur par application d’authentification           |
| [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)     | Acceptée    | Journal d’audit des événements de sécurité                                 |
| [SF-SECURITY-CONFIG-001](SF-SECURITY-CONFIG-001.md)   | Acceptée    | Configuration dynamique des fonctionnalités et politiques de sécurité      |
| [SF-SESSION-001](SF-SESSION-001.md)                   | Implémentée | Enrichissement des sessions actives avec des informations d’identification |
| [SF-PASSWORD-001](SF-PASSWORD-001.md)                 | Implémentée | Politique configurable de mots de passe sécurisés                          |
