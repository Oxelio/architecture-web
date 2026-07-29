# Configuration dynamique des fonctionnalités et politiques de sécurité

> **Identifiant :** SF-SECURITY-CONFIG-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-PASSWORD-001](SF-PASSWORD-001.md),
> [SF-MFA-001](SF-MFA-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md)

## Contexte

Les politiques de sécurité fonctionnelles sont actuellement définies par des
variables d’environnement et construites au démarrage de l’API. C’est notamment
le cas de la politique de mot de passe et de ses contrôles. Un changement exige
donc une intervention sur le déploiement et un redémarrage.

Ce fonctionnement ne permet pas à un administrateur autorisé :

- d’activer ou désactiver une fonctionnalité sans redéploiement ;
- d’adapter une politique de sécurité au contexte de l’organisation ;
- de connaître la configuration réellement appliquée ;
- de mesurer les conséquences et les dépendances d’un changement ;
- de retrouver l’auteur et l’historique des modifications.

## Objectif fonctionnel

Fournir dans l’administration un centre de configuration permettant de piloter
dynamiquement les fonctionnalités optionnelles et les politiques de sécurité.

Une modification publiée doit devenir effective sans redémarrage de
l’application. Le système doit garantir que seules des configurations valides,
cohérentes et attribuables à un administrateur sont appliquées.

Par principe, toute nouvelle fonctionnalité métier doit déclarer explicitement
si elle peut être activée ou désactivée et les réglages qu’elle expose. Une
fonctionnalité qui ne peut pas être désactivée doit justifier cette exception
par une exigence d’intégrité, de sécurité ou d’exploitation.

## Terminologie

- **Fonctionnalité** : capacité métier pouvant être disponible ou indisponible,
  par exemple l’inscription publique ou le MFA.
- **Politique** : ensemble de règles qui encadre une fonctionnalité, par exemple
  le niveau minimal d’un mot de passe.
- **Configuration publiée** : dernière révision validée et demandée par un
  administrateur.
- **Configuration effective** : configuration réellement utilisée par
  l’application.
- **Valeur initiale** : valeur issue du déploiement lors de l’initialisation du
  système.
- **Socle non désactivable** : contrôles nécessaires pour protéger le centre de
  configuration et l’intégrité de l’application.

## Périmètre configurable

La première version doit pouvoir représenter au minimum :

| Domaine           | Options attendues                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Comptes           | inscription publique, vérification de l’adresse électronique, changement d’adresse                                    |
| Authentification  | MFA disponible, MFA obligatoire selon le rôle lorsqu’il est implémenté                                                |
| Mots de passe     | niveau standard et privilégié, longueurs, robustesse et contrôles optionnels de [SF-PASSWORD-001](SF-PASSWORD-001.md) |
| Sessions          | gestion des sessions par l’utilisateur et durée de session lorsqu’elle est configurable                               |
| Récupération      | récupération de compte lorsqu’elle est implémentée                                                                    |
| Données du compte | export et suppression lorsqu’ils sont implémentés                                                                     |
| Audit             | consultation du journal et durée de conservation lorsqu’il est implémenté                                             |

Une option peut être visible avant que sa fonctionnalité soit installée. Dans ce
cas, elle est marquée **indisponible** et ne peut pas être activée. L’interface
ne doit jamais laisser croire qu’une fonctionnalité est effective lorsqu’aucun
composant exécutable ne la prend en charge.

Le catalogue est extensible : l’ajout d’une fonctionnalité ne doit pas imposer
la modification d’un écran spécifique si un type de champ générique suffit.

## Frontière avec la configuration d’exploitation

Le centre d’administration ne doit pas exposer ni modifier :

- les identifiants et mots de passe de base de données, Redis ou SMTP ;
- les clés de chiffrement, secrets de signature et jetons de fournisseurs ;
- les adresses des services d’infrastructure ;
- la confiance accordée à un proxy ;
- les attributs de sécurité des cookies ;
- la politique CORS et les origines de confiance ;
- les algorithmes de hachage ou paramètres cryptographiques nécessitant une
  migration contrôlée ;
- les paramètres indispensables au démarrage ou à la reprise du service.

Ces éléments restent sous le contrôle du déploiement. L’administration peut
afficher leur état non sensible, mais jamais leur valeur secrète ni un formulaire
permettant de les modifier.

## Socle de sécurité non désactivable

Le principe « toute fonctionnalité est optionnelle » ne s’applique pas aux
garanties nécessaires pour administrer ce principe. Restent toujours actifs :

- l’authentification et l’autorisation des accès administratifs ;
- la validation serveur d’une configuration avant publication ;
- l’historique des changements de configuration ;
- la protection contre les modifications concurrentes ;
- l’exclusion des secrets des réponses et journaux ;
- un chemin de récupération contrôlé par l’exploitation ;
- les invariants empêchant de rendre l’administration définitivement
  inaccessible.

La consultation du journal de sécurité peut être optionnelle. L’historique
minimal des changements de configuration reste obligatoire et ne peut pas être
désactivé depuis l’application.

## Catalogue et modèle fonctionnel

Chaque option déclare au minimum :

```text
Option de configuration
- clé stable
- libellé et description
- catégorie
- type et contraintes de valeur
- valeur initiale sécurisée
- valeur publiée
- valeur effective
- disponibilité
- niveau d’impact
- dépendances et incompatibilités
- comportement lors d’une activation ou désactivation
- version d’introduction éventuelle
```

Les types pris en charge incluent au minimum les booléens, entiers et durées
bornés, choix unique dans une liste fermée et ensembles de choix.

Une clé supprimée ou inconnue n’est jamais interprétée silencieusement. Elle est
signalée comme obsolète ou incompatible et ne doit pas empêcher l’application
de charger la dernière révision valide connue.

## Valeurs initiales et source de vérité

Les variables d’environnement fonctionnelles existantes servent à initialiser
la première révision lors de la migration. Après cette initialisation, la
configuration persistée devient la source de vérité fonctionnelle.

Les variables d’environnement ne doivent pas écraser silencieusement une
configuration déjà administrée à chaque redémarrage. Toute capacité
d’exploitation permettant de forcer une valeur doit être explicite, visible
comme telle et documentée.

Lors du premier démarrage :

1. les valeurs existantes sont lues et validées ;
2. une révision initiale est créée ;
3. sa provenance `initialisation du déploiement` est conservée ;
4. les valeurs secrètes ou purement techniques ne sont pas importées.

## Consultation administrative

Un administrateur autorisé peut :

- consulter la configuration publiée et effective ;
- distinguer une valeur personnalisée de sa valeur initiale ;
- rechercher et filtrer par domaine, état et niveau d’impact ;
- comprendre la conséquence d’une activation ou désactivation ;
- voir les dépendances, incompatibilités et fonctions indisponibles ;
- consulter l’auteur, la date et le motif des révisions ;
- comparer une révision avec la précédente.

L’interface présente les réglages par intention métier, sans exiger de connaître
le nom d’une variable d’environnement.

Les valeurs publiques utiles aux parcours utilisateurs, telles que les
exigences de mot de passe, peuvent être exposées par un contrat public dédié.
Les options internes et l’historique ne le sont jamais.

## Modification et publication

La modification suit le parcours suivant :

1. l’administrateur ouvre la dernière révision ;
2. il modifie une ou plusieurs options ;
3. le système valide les types, bornes, dépendances et invariants ;
4. un résumé présente les différences et effets attendus ;
5. l’administrateur fournit un motif ;
6. une confirmation renforcée est demandée pour un changement critique ;
7. les modifications sont publiées dans une seule révision atomique ;
8. la configuration effective est rafraîchie ;
9. le résultat de l’application est affiché.

La confirmation renforcée exige au minimum une authentification récente. Elle
peut aussi exiger le mot de passe et le MFA lorsque celui-ci est disponible.

Une publication « tout ou rien » interdit qu’une partie du formulaire soit
appliquée lorsque l’autre est invalide. Une modification ne peut pas écraser une
révision publiée entre-temps : l’administrateur doit réconcilier le conflit.

## Validation des dépendances

Une option peut déclarer une dépendance obligatoire, une incompatibilité, une
borne liée à une autre option, une conséquence proposée ou un ordre
d’activation. Aucune cascade destructive n’est appliquée implicitement.

Exemples :

- exiger le MFA pour les administrateurs est impossible si le MFA est
  indisponible ;
- désactiver le MFA est refusé tant qu’une politique l’exige pour un rôle ;
- activer une vérification de mots de passe compromis est impossible si aucun
  vérificateur compatible n’est disponible ;
- la longueur minimale d’un mot de passe ne peut pas dépasser sa longueur
  maximale ;
- une fonction ne peut pas être activée si sa migration ou son adaptateur
  requis est absent.

## Effet des changements

Chaque option documente un mode d’effet :

- **immédiat pour les nouvelles opérations** ;
- **immédiat avec réévaluation des données existantes** ;
- **progressif à la prochaine interaction de l’utilisateur** ;
- **différé jusqu’à une date ou condition annoncée** ;
- **redémarrage requis**, seulement si la contrainte est justifiée et affichée.

La première version applique les changements de politique de mot de passe aux
nouveaux mots de passe et aux remplacements, sans invalider silencieusement les
mots de passe déjà stockés. Une action exigée des utilisateurs existants
nécessite un parcours dédié, un délai et une communication.

La désactivation d’une fonctionnalité bloque les nouvelles opérations, conserve
les données nécessaires, définit le sort des opérations déjà engagées et ne
supprime jamais de données par le simple effet du bouton.

## Propagation et cohérence

Après publication, toutes les instances actives doivent converger vers la même
révision. La réponse indique si elle est effective partout, en propagation,
partiellement appliquée, ou refusée et non appliquée.

Une instance ne construit jamais une politique hybride à partir de deux
révisions. Chaque opération métier utilise une révision cohérente.

L’objectif initial de propagation est de cinq secondes au maximum en
fonctionnement nominal. Une option présentant un risque immédiat peut exiger un
mécanisme plus strict.

## Erreurs, repli et restauration

Une configuration invalide n’est jamais publiée. Si une nouvelle révision ne
peut pas devenir effective, le système conserve la dernière configuration
valide connue et signale l’écart. Il ne revient pas silencieusement aux
variables d’environnement.

La restauration d’une ancienne révision crée une nouvelle révision et ne
réécrit pas l’historique. Elle est soumise aux validations courantes.

Une procédure d’exploitation documentée doit permettre de restaurer une
configuration sûre lorsque l’administration est inaccessible. Son usage est
enregistré dès que le stockage redevient disponible.

## Autorisations

Le rôle `admin` existant peut consulter et modifier la configuration dans la
première version. Le modèle distingue néanmoins les capacités de consultation,
proposition, publication, restauration et lecture de l’historique afin de
permettre une séparation ultérieure des responsabilités.

Un administrateur ne peut ni supprimer l’historique, ni modifier l’auteur d’une
révision. Le système refuse une configuration supprimant le dernier chemin
d’accès administratif valide.

## Traçabilité et notifications

Chaque tentative de publication ou restauration enregistre :

- l’identifiant de révision, l’acteur, la date et le motif ;
- les clés modifiées et leurs valeurs non sensibles avant et après ;
- le résultat de validation et d’application ;
- l’origine `administration`, `initialisation`, `restauration` ou
  `exploitation`.

Les changements critiques réussis ou refusés produisent un événement selon
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md) lorsqu’il est disponible. Les
administrateurs concernés sont notifiés après une réduction importante du
niveau de protection.

Une valeur sensible n’apparaît jamais en clair dans une différence, une
notification ou un événement. La première version ne configure aucun secret.

## Expérience utilisateur

L’espace **Administration > Configuration** est une page dédiée. Il ne doit pas
exposer un document JSON, le nom des variables d’environnement ou le format de
persistance comme interface principale.

Les réglages sont regroupés par domaine et rendus à partir d’un catalogue
descriptif :

- interrupteur pour une activation ;
- boutons radio, cartes de choix ou liste fermée pour un niveau ;
- champ numérique, éventuellement couplé à un slider, pour une valeur bornée ;
- sélection multiple pour les rôles ou capacités concernés.

Le slider ne remplace jamais le champ numérique lorsqu’une valeur exacte est
importante ou que la plage est large. Chaque contrôle affiche son unité, ses
bornes, sa valeur recommandée, son effet et la raison de son indisponibilité.
Une option sans consommateur exécutable est visible en lecture seule et marquée
**non effective** ; elle ne peut pas être publiée.

La page doit :

- afficher l’état effectif, pas seulement la valeur enregistrée ;
- utiliser des libellés, aides et conséquences compréhensibles ;
- conserver un brouillon tant qu’il n’est pas publié et permettre de rétablir
  la valeur publiée d’un champ ou de tout le formulaire ;
- valider au fil de la saisie et rattacher chaque erreur au contrôle concerné ;
- signaler les valeurs moins sûres que les recommandations ;
- distinguer avertissement et erreur bloquante ;
- rendre visibles les dépendances avant confirmation ;
- présenter les valeurs avant/après, les fonctions affectées et le mode d’effet
  dans une étape de prévisualisation ;
- exiger un motif non vide avant publication ;
- demander une confirmation explicite pour toute réduction critique ;
- distinguer conflit de version, validation refusée et échec d’application ;
- empêcher les doubles soumissions ;
- être accessible au clavier et aux technologies d’assistance ;
- afficher la date du dernier rafraîchissement et la révision consultée.

Un indicateur « recommandé » aide au choix sans empêcher un déploiement ayant
des contraintes différentes.

L’historique et le journal d’audit sont accessibles depuis la page, mais ne
remplacent pas l’éditeur. L’historique permet d’ouvrir le détail d’une révision,
d’identifier son auteur et son motif, de comparer les valeurs et de demander
une restauration.

Les responsabilités techniques et les écarts actuellement observés sont
documentés dans
[Refonte de la configuration de sécurité](../architecture/security-configuration-redesign.md).

## API et fonctionnalités désactivées

Les contrats administratifs permettent de consulter le catalogue, la révision
effective et l’historique, puis de publier ou restaurer une révision.

Lorsqu’une fonctionnalité est désactivée :

- le client masque ou désactive son point d’entrée ;
- le serveur refuse également l’opération ;
- l’API retourne un code métier stable indiquant son indisponibilité ;
- la réponse ne révèle aucune ressource inaccessible à l’acteur.

Le masquage côté client seul ne constitue jamais un contrôle d’accès.

## Migration

La migration doit :

1. inventorier les variables fonctionnelles existantes ;
2. les séparer des secrets et paramètres d’exploitation ;
3. créer la révision initiale depuis la configuration validée actuelle ;
4. comparer la politique effective avant et après migration ;
5. activer la lecture dynamique ;
6. rendre ensuite les variables fonctionnelles historiques obsolètes ;
7. documenter leur retrait futur.

Pendant la transition, une seule source est autoritaire pour une option donnée.
Deux sources concurrentes ne sont jamais fusionnées selon un ordre implicite.

## Scénarios de test

Les tests couvrent au minimum :

1. initialisation depuis les valeurs fonctionnelles existantes ;
2. consultation refusée à un non-administrateur ;
3. changement valide sans redémarrage ;
4. refus d’un type, d’une borne ou d’une combinaison invalide ;
5. validation des dépendances et indisponibilités ;
6. confirmation renforcée d’une réduction critique ;
7. publication atomique de plusieurs options ;
8. conflit entre deux administrateurs ;
9. convergence de plusieurs instances ;
10. maintien de la dernière révision valide lors d’un échec ;
11. restauration créant une nouvelle révision ;
12. impossibilité de désactiver le socle de sécurité ;
13. absence de secret dans les contrats, différences et traces ;
14. refus serveur d’une fonctionnalité désactivée ;
15. traitement des opérations engagées lors d’une désactivation ;
16. politique de mot de passe appliquée aux nouvelles opérations seulement ;
17. historique complet et non modifiable ;
18. récupération après perte d’accès à l’administration ;
19. option inconnue ou devenue obsolète ;
20. accessibilité du parcours.

## Critères d’acceptation

La fonctionnalité est terminée lorsque :

- un administrateur autorisé publie une configuration sans redémarrage ;
- chaque fonction optionnelle déclare état, dépendances et désactivation ;
- la configuration est validée, versionnée, atomique et historisée ;
- toutes les instances utilisent une révision cohérente dans le délai annoncé ;
- une défaillance conserve la dernière révision valide ;
- secrets et paramètres d’exploitation restent hors du centre ;
- les contrôles du socle ne peuvent pas être désactivés ;
- le serveur refuse réellement les fonctions désactivées ;
- la politique de mot de passe existante est pilotable après migration ;
- les changements critiques sont confirmés, traçables et restaurables.

## Hors périmètre

Cette première version n’inclut pas :

- la gestion des secrets ou identifiants d’infrastructure ;
- une configuration par utilisateur, groupe ou organisation ;
- l’activation progressive par pourcentage d’utilisateurs ;
- la planification d’une révision future ;
- un workflow d’approbation à plusieurs personnes ;
- la modification à chaud des algorithmes cryptographiques ;
- la suppression automatique des données à la désactivation.
