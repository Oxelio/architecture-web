# Journal d’audit des événements de sécurité

> **Identifiant :** SF-SECURITY-AUDIT-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Contexte métier

Le module IAM réalise des opérations sensibles : connexions, changements
d’identifiants, gestion des sessions et actions administratives. Sans historique
centralisé, il est difficile d’expliquer une modification, d’analyser un
incident ou de distinguer une action légitime d’un abus.

Un journal d’application général ne constitue pas un journal d’audit : il peut
être incomplet, trop technique, modifiable et contenir des secrets.

## Objectif fonctionnel

Créer un historique durable, consultable et minimisé des événements de sécurité
afin de répondre aux questions suivantes :

- quelle action a été tentée ;
- quand et avec quel résultat ;
- par quel acteur connu ou anonyme ;
- sur quel compte ;
- depuis quel contexte approximatif ;
- quelle corrélation permet de poursuivre l’analyse.

Le journal sert à l’investigation et à l’information. Il ne doit pas devenir un
mécanisme d’autorisation ni bloquer une opération métier en cas d’indisponibilité
temporaire sans politique explicitement définie.

## Événements couverts

La première version enregistre au minimum :

- connexion réussie ou refusée et déconnexion ;
- création de compte et vérification d’adresse ;
- demande et réussite de récupération de compte ;
- changement de mot de passe ou d’adresse ;
- création et révocation de session ;
- activation, suspension et changement de rôle ;
- activation, utilisation d’un code de secours et désactivation du MFA lorsque
  [SF-MFA-001](SF-MFA-001.md) est disponible ;
- demande, génération et téléchargement d’un export ;
- demande, annulation et exécution d’une suppression de compte.

Les événements répétitifs peuvent être regroupés pour la consultation, mais les
faits nécessaires à une investigation ne doivent pas être perdus.

## Modèle fonctionnel

Chaque événement contient au minimum :

```text
Événement de sécurité
- identifiant
- type stable
- date de survenue
- résultat : succès, refus ou échec technique
- acteur : utilisateur, administrateur, système ou anonyme
- sujet concerné éventuel
- identifiant de corrélation éventuel
- contexte client et réseau minimisé éventuel
- métadonnées propres au type d’événement
```

Un changement conserve l’ancienne et la nouvelle valeur seulement lorsque cela
est nécessaire et non sensible. Un changement de rôle ou de statut peut les
conserver ; un mot de passe, un jeton, un secret MFA et un cookie ne le peuvent
jamais.

## Intégrité et ordre

Le journal est en ajout uniquement. Aucun utilisateur, y compris administrateur,
ne peut modifier ou supprimer sélectivement un événement depuis l’application.

Chaque événement possède un identifiant stable et une date attribuée par le
système. La consultation utilise un ordre déterministe, du plus récent au plus
ancien, et une pagination bornée.

Une opération métier réussie ne doit pas être présentée comme auditée avant que
son événement soit durablement accepté. La stratégie de reprise en cas
d’indisponibilité doit éviter les doublons visibles et documenter le risque de
perte éventuel.

## Consultation et autorisation

Un utilisateur authentifié peut consulter les événements de sécurité qui
concernent son propre compte et qui lui sont utiles, sans voir les métadonnées
internes ni l’identité d’un administrateur au-delà de ce qui est nécessaire.

Un administrateur peut consulter les événements selon ses permissions avec des
filtres sur :

- période ;
- type et résultat ;
- acteur ou sujet connu ;
- identifiant de corrélation.

Un utilisateur non administrateur ne peut ni interroger les événements d’un
autre compte, ni déduire leur existence. La consultation elle-même est auditée.

## Données personnelles et secrets

Sont interdits dans le journal :

- mots de passe et confirmations ;
- jetons de session, récupération ou vérification ;
- secrets MFA et codes de secours ;
- contenu complet des e-mails ;
- en-têtes d’autorisation ;
- corps de requête non filtrés.

L’adresse IP et les informations client sont facultatives, protégées comme des
données personnelles et affichées seulement aux acteurs autorisés. Les tentatives
anonymes ne doivent pas conduire à stocker indéfiniment une adresse e-mail en
clair ; une référence pseudonymisée peut être utilisée pour détecter les abus.

## Rétention et suppression

La durée initiale de conservation est de 12 mois et doit être configurable.
Une durée différente peut être imposée par le contexte de déploiement.

À l’expiration, les événements sont supprimés ou agrégés de manière
irréversible. Après suppression d’un compte, les événements encore nécessaires
à la sécurité peuvent être conservés jusqu’à leur échéance, mais leurs
références directes au compte doivent être supprimées ou pseudonymisées.

Une obligation de conservation légale documentée peut suspendre la purge
concernée. Elle ne permet pas d’étendre silencieusement la collecte.

## Scénarios de test

Les tests couvrent au minimum :

1. production d’un événement pour chaque opération sensible ;
2. distinction entre succès, refus métier et échec technique ;
3. ordre stable et pagination bornée ;
4. filtres administratifs ;
5. consultation limitée au propriétaire ;
6. refus d’accès transversal ;
7. impossibilité de modifier ou supprimer sélectivement un événement ;
8. absence de tout secret ;
9. pseudonymisation des tentatives anonymes ;
10. audit de la consultation administrative ;
11. purge à échéance et traitement d’un compte supprimé ;
12. comportement déterminé lors d’une indisponibilité du stockage d’audit.

## Critères d’acceptation

La fonctionnalité est terminée lorsque les opérations sensibles produisent des
événements structurés et consultables, que les autorisations empêchent toute
lecture transversale, que les secrets sont exclus, que la rétention est
appliquée et que le comportement face aux erreurs d’écriture est explicite et
testé.

## Hors périmètre

Cette spécification n’inclut pas :

- un SIEM complet ou un moteur de détection de fraude ;
- le blocage automatique fondé sur les événements ;
- la conservation illimitée ;
- l’enregistrement exhaustif de toutes les requêtes HTTP ;
- la modification manuelle de l’historique ;
- des garanties cryptographiques de non-répudiation.
