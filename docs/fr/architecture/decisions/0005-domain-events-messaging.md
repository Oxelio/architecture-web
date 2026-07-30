# ADR-0005 — Domain Events et livraison inter-contextes

**Statut : acceptée**

## Contexte

IAM doit alimenter des notifications utilisateur et administrateur ainsi qu’un
journal d’audit sans connaître leurs modèles ni leurs canaux de livraison. Les
effets déclenchés après une écriture PostgreSQL doivent pouvoir être repris
après une indisponibilité sans annuler une opération métier déjà validée.

L’architecture possède déjà des racines d’agrégat et une unité de travail
PostgreSQL. Les sessions restent stockées séparément dans Redis.

## Options considérées

1. conserver tous les effets secondaires directement dans les cas
   d’utilisation ;
2. publier uniquement des événements en mémoire après les écritures ;
3. enregistrer des Domain Events dans les agrégats, les traduire en contrats
   d’intégration et les livrer au moyen d’une outbox transactionnelle.

## Décision

Foundation fournit la primitive générique `DomainEvent`. `AggregateRoot`
enregistre les événements en attente et permet à la persistance de les retirer
après sauvegarde.

IAM reste propriétaire de ses événements métier et de leur traduction en
contrats d’intégration versionnés. Une sauvegarde PostgreSQL réalisée par
`IamUnitOfWork` écrit l’état métier et les messages sortants dans la même
transaction.

Le core `@architecture/messaging` fournit le domaine de l’outbox, l’enveloppe
d’intégration, les ports, le routeur et le worker. L’adaptateur
`@architecture/messaging-persistence-kysely` implémente les ports de l’outbox
et porte la migration PostgreSQL. La livraison est au moins une fois ; les
consommateurs sont idempotents grâce à l’identifiant stable de l’événement.
Les échecs sont repris avec temporisation puis placés en échec définitif après
dix tentatives.

Audit et Notifications sont des bounded contexts séparés :

- Audit conserve des preuves en ajout uniquement, applique la rétention et
  répond aux consultations ;
- Notifications possède son agrégat, les états lu/non lu, les préférences et
  les demandes de livraison ; ses packages d’infrastructure implémentent
  Kysely, e-mail, Slack, SMS et l’annuaire IAM ;
- le client Web consulte les notifications persistées et interroge
  périodiquement le nombre de non-lues.

Les événements liés à une session Redis sont placés durablement dans l’outbox
après la réussite de l’opération Redis. PostgreSQL et Redis ne partageant pas de
transaction, cette séquence ne fournit pas la même atomicité que les commandes
PostgreSQL.

L’outbox, le routeur et les workers sont une infrastructure technique partagée,
pas un Shared Kernel DDD. Les autres bounded contexts consomment les contrats
publics du producteur et n’importent pas ses entités.

## Conséquences

- ajouter un consommateur ne modifie plus l’agrégat producteur ;
- Audit et Notifications peuvent échouer temporairement sans perdre les faits
  PostgreSQL validés ;
- les handlers doivent rester idempotents et les contrats doivent être
  versionnés ;
- le démarrage de l’API suppose que les migrations messaging, audit et
  notifications ont été appliquées ;
- les échecs définitifs doivent être supervisés ;
- l’e-mail contenant un jeton de vérification reste envoyé par le parcours
  applicatif protégé : le jeton brut n’entre ni dans un Domain Event générique,
  ni dans Audit ;
- aucune garantie de transaction distribuée n’est revendiquée pour Redis.
