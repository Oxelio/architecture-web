# Centre de notifications et diffusion multicanale

> **Identifiant :** SF-NOTIFICATIONS-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-MFA-001](SF-MFA-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Contexte métier

Les actions liées au compte et à la sécurité doivent pouvoir informer un
utilisateur ou un administrateur sans intégrer la logique de présentation et de
livraison dans IAM. Une même situation peut nécessiter une notification visible
dans l’application, un e-mail, un message Slack ou un SMS.

Le produit doit également pouvoir ajouter un canal ou une nouvelle réaction à
un fait métier sans modifier le cas d’utilisation qui a produit ce fait.

## Objectif fonctionnel

Fournir un centre de notifications durable et une diffusion multicanale qui
permettent :

- d’informer un utilisateur des changements concernant son compte ;
- d’alerter les administrateurs ou l’équipe de sécurité selon une politique
  explicite ;
- de consulter et acquitter les notifications depuis l’application web ;
- de distribuer une même information par un ou plusieurs canaux ;
- de suivre les tentatives de livraison sans dupliquer les messages visibles ;
- de préserver une séparation claire entre IAM, Notifications et Audit.

L’échec temporaire d’un canal ne doit pas annuler une opération métier déjà
validée.

## Acteurs

- **Utilisateur** : consulte et acquitte ses notifications, et configure les
  préférences autorisées.
- **Administrateur** : reçoit et consulte les alertes correspondant à ses
  permissions.
- **Système** : transforme des faits métier ou de sécurité en notifications.
- **Opérateur** : configure les fournisseurs et supervise les échecs de
  livraison sans accéder aux secrets métier.

## Frontières fonctionnelles

### IAM

IAM reste propriétaire des comptes, identités, rôles, statuts, authentification
et sessions. Il constate des faits tels que :

- utilisateur inscrit ;
- adresse électronique changée ou vérifiée ;
- mot de passe changé ;
- rôle modifié ;
- utilisateur suspendu ou activé ;
- session ouverte ou révoquée ;
- MFA activé ou désactivé.

IAM ne choisit ni le canal, ni le modèle de message, ni la liste finale des
destinataires d’une notification.

### Notifications

Notifications constitue un bounded context séparé. Il est propriétaire :

- des notifications et de leur cycle de vie ;
- des destinataires ;
- des politiques de diffusion ;
- des préférences autorisées ;
- des représentations destinées aux différents canaux ;
- des tentatives et états de livraison.

### Audit

Audit constitue un bounded context séparé et suit
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md). Il est propriétaire du
journal en ajout uniquement, de la consultation, de la rétention et des
exports.

Audit reçoit les faits métier réussis ainsi que les tentatives, refus et
anomalies de sécurité qui ne correspondent pas nécessairement à une transition
d’un agrégat.

Audit ne livre pas directement de message. Lorsqu’une politique de sécurité
détecte une situation à signaler, elle produit un fait d’alerte que
Notifications transforme en messages destinés aux acteurs concernés.

## Sources des notifications

Une notification est créée en réaction à un fait stable, exprimé au passé. Par
exemple :

- `UserPasswordChanged` ;
- `UserEmailChanged` ;
- `UserSuspended` ;
- `UserRoleChanged` ;
- `SessionStarted` ;
- `MfaDisabled` ;
- `SuspiciousActivityDetected`.

Les faits issus du domaine décrivent ce qui s’est produit et ne contiennent pas
d’instruction technique telle que `SendEmail` ou `PostToSlack`.

Les opérations sans changement métier réussi peuvent aussi produire des faits
applicatifs ou de sécurité, par exemple une série de connexions refusées. Une
politique dédiée décide si ces faits doivent déclencher une notification.

## Modèle fonctionnel

Une notification contient au minimum :

```text
Notification
- identifiant
- type stable et versionné
- destinataire
- date de création
- niveau : information, avertissement ou critique
- titre et message affichable
- action facultative vers une destination autorisée
- état : non lue, lue ou archivée
- fait d’origine et identifiant de corrélation
- livraisons demandées par canal
```

Chaque livraison contient :

```text
Livraison
- canal
- état : en attente, envoyée, échouée temporairement ou échouée définitivement
- nombre de tentatives
- date de dernière tentative
- référence technique minimisée éventuelle
```

Une nouvelle tentative de livraison ne crée pas une seconde notification
visible pour le même destinataire et le même fait d’origine.

## Centre de notifications web

Un utilisateur authentifié peut :

- consulter ses notifications dans un ordre déterministe, de la plus récente à
  la plus ancienne ;
- connaître le nombre de notifications non lues ;
- marquer une notification comme lue ;
- marquer toutes ses notifications comme lues ;
- ouvrir l’action associée lorsqu’elle est encore valide.

La consultation est paginée et bornée. Un utilisateur ne peut ni consulter ni
modifier les notifications d’un autre utilisateur.

Une notification peut être affichée en temps réel lorsque le client est
connecté. L’absence de connexion temps réel ne doit pas empêcher sa consultation
ultérieure.

## Canaux

La première architecture cible prend en charge les catégories de canaux
suivantes :

- **Web** : notification persistée et affichée dans l’application ;
- **E-mail** : message envoyé à une adresse validée ;
- **Slack** : message destiné à un espace ou canal administratif configuré ;
- **SMS** : message bref envoyé à un numéro vérifié et autorisé.

La disponibilité d’un canal dépend de la configuration du déploiement. L’ajout
ou le retrait d’un fournisseur technique ne change pas la signification métier
de la notification.

Une politique peut demander plusieurs canaux pour le même destinataire. L’échec
d’un canal n’empêche pas les autres canaux d’être tentés.

## Destinataires et politiques

La politique de notification détermine les destinataires à partir du type de
fait, de sa sensibilité et du contexte autorisé :

- l’utilisateur concerné ;
- un ou plusieurs administrateurs autorisés ;
- une destination opérationnelle telle qu’un canal Slack de sécurité.

Le producteur du fait ne doit pas figer une adresse e-mail, un numéro de
téléphone ou une destination Slack dans l’événement.

Les alertes administratives respectent les permissions et ne révèlent que les
données nécessaires. L’appartenance à un rôle au moment de la distribution est
vérifiée selon la politique applicable.

## Préférences

Un utilisateur peut désactiver les canaux facultatifs ou choisir parmi les
canaux disponibles.

Les notifications de sécurité critiques peuvent être obligatoires. La politique
indique explicitement :

- les notifications non désactivables ;
- les canaux minimums requis ;
- les éventuels canaux de secours ;
- les destinataires administratifs.

Une préférence ne permet jamais de désactiver l’enregistrement d’un événement
dans Audit.

## Catalogue initial

La première version doit permettre de définir des politiques pour :

- inscription et vérification de l’adresse électronique ;
- changement d’adresse ou de mot de passe ;
- nouvelle session ou révocation de sessions ;
- activation, désactivation et usage d’un moyen de secours MFA ;
- récupération de compte ;
- changement de rôle, suspension et activation ;
- demande et exécution d’une suppression de compte ;
- activité suspecte détectée selon une politique distincte.

Ce catalogue est extensible. Ajouter un canal ou une nouvelle réaction ne doit
pas exiger de modifier le fait métier d’origine.

## Fiabilité et cohérence

Un fait associé à une modification persistée n’est distribuable qu’après la
réussite de cette modification.

Une notification acceptée doit pouvoir être reprise après une indisponibilité
temporaire. Le système garantit :

- un identifiant stable pour le fait et la notification ;
- une consommation idempotente ;
- des tentatives bornées et observables ;
- l’absence de doublon visible malgré une livraison potentiellement répétée ;
- un état final explicite lorsqu’un canal ne peut plus être livré.

Les notifications sont cohérentes de manière éventuelle avec l’opération
métier. Les invariants de sécurité qui doivent être immédiats, tels que le refus
d’une session invalide, ne reposent pas uniquement sur une notification ou un
traitement asynchrone.

## Données personnelles et secrets

Les événements, notifications et livraisons minimisent les données
personnelles. Ils ne contiennent jamais :

- mot de passe ou confirmation ;
- jeton de session, récupération ou vérification en clair ;
- secret MFA ou code de secours ;
- en-tête d’autorisation ;
- corps de requête non filtré.

Une notification web n’affiche aucune donnée plus sensible que ce que son
destinataire est autorisé à consulter au moment de l’ouverture.

Les liens à usage unique utilisent un mécanisme de livraison protégé. Leur
contenu sensible n’est pas exposé dans un événement métier générique ni dans le
journal d’audit.

## Articulation avec Audit

Les faits métier réussis peuvent alimenter simultanément Notifications et Audit.
Ils restent interprétés selon la responsabilité de chaque bounded context :

- Notifications décide s’il faut informer quelqu’un et suit la livraison ;
- Audit conserve une preuve structurée de l’action ou de la tentative.

Les erreurs opérationnelles ordinaires d’un fournisseur de livraison restent
dans l’historique de Notifications. Un échec présentant un intérêt de sécurité,
un changement de politique ou une consultation administrative sensible peut
également produire une entrée Audit.

## Principes structurants de la cible

Cette section précise les contraintes nécessaires au comportement fonctionnel ;
elle ne décrit pas l’implémentation actuelle.

- Les événements métier appartiennent au bounded context qui produit le fait.
- Les autres bounded contexts consomment un contrat d’intégration public et
  versionné, jamais une entité interne du producteur.
- Les primitives génériques d’événement peuvent appartenir à Foundation.
- La publication, la reprise, l’idempotence et l’outbox appartiennent à une
  infrastructure de messaging partagée.
- Cette infrastructure technique n’est pas un Shared Kernel DDD.
- Un Shared Kernel éventuel ne contiendrait qu’un modèle métier volontairement
  partagé et gouverné conjointement.
- Le stockage transactionnel d’un fait sortant reste coordonné avec le stockage
  du bounded context producteur.

Le dépôt ne fournit actuellement ni bounded context Notifications, ni bus
d’événements, ni outbox durable. Leur introduction est donc une évolution
future et doit faire l’objet d’une décision architecturale détaillée avant
implémentation.

## Scénarios de test

Les tests couvrent au minimum :

1. création d’une notification à partir d’un fait éligible ;
2. absence de notification lorsqu’aucune politique ne correspond ;
3. sélection correcte des destinataires utilisateur et administrateur ;
4. respect des préférences et des notifications obligatoires ;
5. consultation paginée limitée au destinataire ;
6. compteur de non-lues et acquittement unitaire ou global ;
7. distribution indépendante par Web, e-mail, Slack et SMS configurés ;
8. reprise après un échec temporaire ;
9. échec définitif après la politique de tentatives ;
10. absence de doublon visible lors d’une consommation répétée ;
11. poursuite des autres canaux lorsqu’un fournisseur échoue ;
12. absence de tout secret dans les événements et messages ;
13. production parallèle des informations nécessaires à Audit ;
14. consultation ultérieure après absence de connexion temps réel ;
15. impossibilité pour un producteur IAM de sélectionner directement un
    fournisseur ou une destination technique.

## Critères d’acceptation

La fonctionnalité est terminée lorsque les utilisateurs peuvent consulter et
acquitter leurs notifications, que les politiques déterminent correctement les
destinataires et canaux, que les livraisons sont reprises sans doublon visible,
que les alertes administratives respectent les permissions, que les secrets
sont exclus et qu’Audit reçoit les faits nécessaires indépendamment des
livraisons.

## Hors périmètre

Cette spécification n’inclut pas :

- un moteur complet de détection de fraude ou un SIEM ;
- l’utilisation du SMS ou de l’e-mail comme facteur d’authentification ;
- le contenu marketing et les campagnes commerciales ;
- une conversation bidirectionnelle avec Slack ou par SMS ;
- une garantie de livraison fournie par un opérateur externe ;
- l’Event Sourcing ;
- un Shared Kernel métier entre IAM, Notifications et Audit.
