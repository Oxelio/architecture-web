# Enrichir les sessions actives avec des informations d’identification

> **Identifiant :** SF-SESSION-001
>
> **Statut :** Implémentée
>
> **Documentation technique :** [Authentification et sessions](../guides/identity-sessions.md)

## Contexte métier

L’application permet actuellement de supprimer les sessions actives associées à un utilisateur.

Deux acteurs peuvent réaliser cette action :

- un utilisateur peut consulter et supprimer uniquement ses propres sessions ;
- un administrateur peut consulter et supprimer les sessions de tous les utilisateurs.

Actuellement, une session est principalement identifiable par son identifiant technique. Cet identifiant ne permet pas à une personne de comprendre à quel appareil, navigateur ou contexte de connexion correspond la session.

Lorsqu’un utilisateur possède plusieurs sessions actives, il ne peut donc pas déterminer facilement laquelle doit être conservée ou supprimée. De la même manière, un administrateur dispose de trop peu d’informations pour analyser une session ou identifier une connexion potentiellement inhabituelle.

## Objectif fonctionnel

Enrichir les sessions avec des informations compréhensibles permettant :

1. à un utilisateur d’identifier les différentes sessions ouvertes sur son compte ;
2. à un utilisateur de déterminer quelle session il souhaite révoquer ;
3. à un administrateur de comprendre l’origine probable d’une session ;
4. à un administrateur d’identifier plus facilement une session inhabituelle ou potentiellement suspecte.

L’identifiant technique de session doit être conservé pour le fonctionnement interne, mais il ne doit plus être la seule information disponible pour identifier une session.

## Informations attendues pour une session

Chaque session doit pouvoir exposer, lorsque l’information est disponible, les éléments suivants.

### Appareil et système

- type d’appareil, par exemple ordinateur, téléphone, tablette ou appareil inconnu ;
- système d’exploitation, par exemple Windows, Linux, macOS, Android ou iOS ;
- éventuellement la version du système lorsqu’elle peut être déterminée de manière fiable.

### Navigateur ou application

- nom du navigateur utilisé ;
- version du navigateur, lorsqu’elle est disponible ;
- nom de l’application cliente lorsqu’il ne s’agit pas d’un navigateur ;
- possibilité de représenter un client inconnu lorsque l’information ne peut pas être déterminée.

### Adresse IP et localisation

- adresse IP ayant créé la session ou correspondant à la connexion concernée ;
- localisation approximative associée à cette adresse IP lorsque cette fonctionnalité est disponible ;
- au minimum, la localisation peut contenir le pays ;
- la ville ou la région peuvent être ajoutées lorsque les données disponibles sont suffisamment fiables.

La localisation doit toujours être présentée comme approximative. Elle ne doit pas être considérée comme une position exacte de l’utilisateur.

### Dates et activité

- date de création de la session ;
- date de dernière activité connue ;
- date d’expiration prévue, si les sessions possèdent une expiration ;
- état indiquant si la session est encore active ;
- indication permettant de reconnaître la session actuellement utilisée par l’utilisateur.

## Comportement attendu pour l’utilisateur

Lorsqu’un utilisateur consulte ses sessions actives, chaque session doit être présentée avec suffisamment d’informations pour qu’il puisse la distinguer des autres.

Une session pourrait par exemple être représentée fonctionnellement comme :

```text
Chrome sur Windows
Paris, France — adresse IP 192.0.2.10
Créée le 12 juillet 2026
Dernière activité il y a 5 minutes
Session actuelle
```

L’utilisateur doit pouvoir :

- consulter uniquement les sessions qui lui appartiennent ;
- identifier la session actuellement utilisée ;
- révoquer une autre session ;
- éviter de supprimer accidentellement sa session actuelle sans avertissement explicite ;
- distinguer plusieurs sessions provenant d’appareils ou de navigateurs différents.

Si l’application autorise la suppression de la session actuelle, ce comportement doit être explicite et entraîner la déconnexion de l’utilisateur.

## Comportement attendu pour l’administrateur

Un administrateur doit pouvoir consulter les mêmes informations pour les sessions des utilisateurs qu’il est autorisé à administrer.

L’administrateur doit pouvoir :

- identifier l’utilisateur propriétaire de la session ;
- consulter les informations d’appareil, de système, de navigateur, d’adresse IP et d’activité ;
- révoquer une session active ;
- distinguer plusieurs sessions appartenant au même utilisateur ;
- repérer plus facilement une session ancienne, inactive ou provenant d’un environnement inhabituel.

Cette fonctionnalité ne doit pas modifier les règles d’autorisation existantes :

- un utilisateur ne peut consulter ou révoquer que ses propres sessions ;
- un administrateur peut consulter ou révoquer les sessions selon les permissions administratives déjà définies dans le projet.

## Création et mise à jour d’une session

Lorsqu’une nouvelle session est créée, le système doit collecter les informations disponibles dans le contexte de la requête ou du client.

Ces informations peuvent notamment provenir :

- de l’adresse IP de la requête ;
- du `User-Agent` ;
- des métadonnées transmises par une application cliente ;
- de la date de création ;
- du mécanisme de suivi de l’activité déjà existant.

L’agent doit analyser l’architecture actuelle afin de déterminer quelles données doivent être :

- persistées directement dans la session ;
- calculées au moment de la lecture ;
- enrichies par un service externe ou un adaptateur d’infrastructure ;
- représentées comme facultatives lorsqu’elles ne sont pas disponibles.

La couche métier ne doit pas dépendre directement d’une bibliothèque d’analyse de `User-Agent`, d’un fournisseur de géolocalisation IP ou d’un framework HTTP.

Les données issues de l’environnement HTTP doivent être traduites en données métier ou en métadonnées de session avant d’entrer dans le cœur applicatif.

## Dernière activité

La session doit exposer une date de dernière activité.

L’agent doit vérifier si une notion équivalente existe déjà dans le projet.

Dans le cas contraire, il doit proposer et implémenter un mécanisme cohérent permettant de mettre à jour cette information sans effectuer inutilement une écriture en base de données à chaque requête.

Une stratégie de limitation des mises à jour peut être utilisée, par exemple en ne mettant à jour la dernière activité qu’après un intervalle défini.

Le choix technique appartient à l’agent, mais le comportement fonctionnel doit rester le suivant :

- une activité récente doit pouvoir être distinguée d’une session inactive ;
- la valeur affichée n’a pas besoin d’être précise à la seconde ;
- le mécanisme ne doit pas provoquer une charge disproportionnée sur le stockage.

## Localisation à partir de l’adresse IP

La localisation associée à une session est facultative.

L’absence de service de géolocalisation ou l’échec de résolution d’une adresse IP ne doit jamais empêcher :

- la création d’une session ;
- l’authentification de l’utilisateur ;
- la consultation des sessions ;
- la révocation d’une session.

Les cas suivants doivent être gérés :

- adresse IP locale ;
- adresse IP privée ;
- adresse de loopback ;
- adresse IP inconnue ;
- proxy ou reverse proxy ;
- plusieurs adresses présentes dans des en-têtes transférés ;
- échec du fournisseur de géolocalisation ;
- localisation non disponible.

L’adresse IP réelle du client ne doit être extraite depuis des en-têtes comme `X-Forwarded-For` que si l’application est configurée pour faire confiance au proxy concerné.

## Protection des données

Les informations de session peuvent contenir des données personnelles ou sensibles du point de vue de la confidentialité.

L’implémentation doit respecter les principes suivants :

- ne collecter que les données nécessaires à l’identification et à la sécurité des sessions ;
- ne pas collecter de position géographique précise ;
- ne pas utiliser de mécanisme de fingerprinting invasif ;
- ne pas exposer les informations d’une session à un utilisateur non autorisé ;
- ne pas inscrire les identifiants de session ou les jetons d’authentification complets dans les journaux ;
- ne jamais exposer le secret ou le jeton permettant d’utiliser une session ;
- conserver une représentation claire des données optionnelles ou inconnues.

L’agent doit vérifier si une politique de rétention ou de suppression des sessions existe déjà et s’y conformer.

## Modèle fonctionnel attendu

Le modèle exposé par l’application doit permettre de représenter au minimum :

```text
Session
- identifiant
- date de création
- date de dernière activité
- date d’expiration éventuelle
- état actif ou expiré
- indication de session actuelle
- adresse IP éventuelle
- localisation approximative éventuelle
- type d’appareil éventuel
- système d’exploitation éventuel
- navigateur ou application éventuel
```

Cette liste décrit le besoin fonctionnel. L’agent doit déterminer la structure technique exacte en fonction des conventions existantes du projet.

Il peut être pertinent de regrouper certaines informations dans des objets dédiés, par exemple :

- informations du client ;
- informations réseau ;
- localisation approximative ;
- informations d’activité.

L’agent ne doit cependant pas introduire d’abstraction inutile si le projet dispose déjà d’un modèle adapté.

## Compatibilité avec les sessions existantes

L’évolution doit rester compatible avec les sessions créées avant l’ajout de ces nouvelles informations.

Une ancienne session ne possédant pas les nouvelles métadonnées doit pouvoir :

- être chargée ;
- être listée ;
- être révoquée ;
- être présentée avec des valeurs telles que « appareil inconnu », « navigateur inconnu » ou « localisation indisponible ».

L’absence de métadonnées ne doit pas rendre une ancienne session invalide.

Si une migration du stockage est nécessaire, elle doit prévoir des valeurs facultatives ou neutres pour les données historiques.

## API et contrats

Les contrats permettant de créer, lire et lister les sessions doivent être adaptés afin d’exposer les nouvelles informations utiles.

L’agent doit identifier :

- les commandes ou cas d’usage responsables de la création des sessions ;
- les cas d’usage permettant à un utilisateur de consulter ses sessions ;
- les cas d’usage administratifs ;
- les ports de persistance associés ;
- les adaptateurs HTTP ou autres interfaces d’entrée ;
- les représentations retournées aux clients.

Les contrats publics ne doivent exposer que les informations nécessaires à l’affichage et à la gestion d’une session.

Les objets métier internes et les objets de réponse d’API peuvent rester distincts si cette séparation correspond à l’architecture actuelle.

Toute modification incompatible d’un contrat public doit être explicitement signalée dans le compte rendu de l’agent.

## Règles d’autorisation

Les règles suivantes doivent être garanties par des tests :

1. un utilisateur peut consulter ses propres sessions ;
2. un utilisateur ne peut pas consulter les sessions d’un autre utilisateur ;
3. un utilisateur peut révoquer l’une de ses sessions ;
4. un utilisateur ne peut pas révoquer la session d’un autre utilisateur ;
5. un administrateur autorisé peut consulter les sessions des utilisateurs concernés ;
6. un administrateur autorisé peut révoquer une session ;
7. les métadonnées supplémentaires ne doivent pas contourner les règles d’autorisation existantes.

## Cas particuliers

L’implémentation doit gérer au minimum les situations suivantes :

- `User-Agent` absent ;
- `User-Agent` invalide ou non reconnu ;
- navigateur inconnu ;
- application cliente personnalisée ;
- adresse IP absente ;
- adresse IP locale ou privée ;
- localisation impossible à déterminer ;
- session créée avant l’ajout des métadonnées ;
- date de dernière activité absente ;
- session expirée mais encore présente dans le stockage ;
- session actuellement utilisée ;
- plusieurs sessions possédant des informations similaires ;
- tentative d’accès à la session d’un autre utilisateur.

## Travail demandé

1. Analyser le modèle de session existant ainsi que les cas d’usage de création, de consultation et de révocation.
2. Identifier les couches et contrats concernés par l’enrichissement des sessions.
3. Faire évoluer le modèle afin de représenter les informations nécessaires.
4. Collecter les informations disponibles lors de la création d’une session.
5. Ajouter ou adapter le suivi de la dernière activité.
6. Adapter la persistance des sessions.
7. Prévoir la compatibilité avec les anciennes sessions.
8. Adapter les cas d’usage utilisateur et administrateur.
9. Adapter les contrats d’entrée et de sortie concernés.
10. Ajouter les mécanismes d’enrichissement nécessaires derrière des abstractions cohérentes avec l’architecture.
11. Ajouter les tests unitaires, d’intégration et d’autorisation pertinents.
12. Mettre à jour la documentation du module de session.
13. Fournir un compte rendu des choix réalisés et des éventuelles migrations nécessaires.

## Critères d’acceptation

La tâche est considérée comme terminée lorsque :

- une nouvelle session contient ou expose les informations disponibles sur le client utilisé ;
- les sessions peuvent être distinguées autrement que par leur identifiant ;
- l’appareil et le système sont exposés lorsqu’ils peuvent être déterminés ;
- le navigateur ou l’application cliente est exposé lorsqu’il peut être déterminé ;
- l’adresse IP est associée à la session lorsque cela est possible ;
- une localisation approximative peut être exposée sans être obligatoire ;
- la date de création est disponible ;
- la date de dernière activité est disponible ou explicitement inconnue ;
- la session actuelle peut être identifiée dans la liste de l’utilisateur ;
- les anciennes sessions restent consultables et révocables ;
- un échec d’analyse du client ou de géolocalisation ne bloque pas l’authentification ;
- les permissions utilisateur et administrateur sont respectées ;
- aucune donnée secrète de session n’est exposée ;
- les nouveaux comportements sont couverts par des tests ;
- les choix techniques et les impacts sur les contrats sont documentés.

## Hors périmètre

Sauf nécessité directement liée à l’architecture existante, cette tâche ne demande pas :

- de développer une interface graphique complète ;
- de créer un système avancé de détection automatique de fraude ;
- de bloquer automatiquement une connexion selon sa localisation ;
- de calculer une position géographique précise ;
- de mettre en place un fingerprinting complet de l’appareil ;
- d’envoyer des alertes par e-mail lors d’une nouvelle connexion ;
- de modifier les règles générales d’authentification.

L’objectif est d’enrichir les sessions afin qu’elles puissent être comprises, identifiées et révoquées de manière fiable.
