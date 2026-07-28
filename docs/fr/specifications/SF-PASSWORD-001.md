# Politique configurable de mots de passe sécurisés

> **Identifiant :** SF-PASSWORD-001
>
> **Statut :** Implémentée
>
> **Documentation technique :** [Politique de mot de passe](../guides/password-policy.md)

## Contexte

L’application permet actuellement de créer un compte utilisateur avec un mot de passe et permet également à un utilisateur authentifié de modifier son mot de passe.

Les exigences relatives aux mots de passe sont actuellement absentes, insuffisantes ou non formellement définies.

Cela entraîne plusieurs risques :

- les utilisateurs peuvent choisir des mots de passe trop courts ou faciles à deviner ;
- les mots de passe peuvent déjà apparaître dans des fuites de données connues ;
- les règles de validation peuvent différer entre la création d’un compte et le changement de mot de passe ;
- une erreur de saisie peut conduire à enregistrer un mot de passe différent de celui souhaité ;
- l’application peut s’appuyer sur des règles de composition anciennes sans fournir de sécurité réellement pertinente.

Une politique cohérente de gestion des mots de passe doit donc être mise en place pour toutes les opérations définissant un nouveau mot de passe.

## Objectif fonctionnel

Mettre en œuvre une politique configurable de sécurité des mots de passe qui :

1. impose un niveau de robustesse adapté ;
2. s’applique de manière cohérente lors de la création d’un compte et du changement de mot de passe ;
3. refuse les mots de passe connus comme faibles, courants ou compromis ;
4. permet de configurer le niveau de sécurité attendu ;
5. confirme que le mot de passe saisi par l’utilisateur correspond bien à celui qu’il souhaite enregistrer ;
6. fournit des retours de validation compréhensibles sans exposer d’informations sensibles ;
7. suit les recommandations actuelles d’organismes reconnus tels que le NIST, l’ANSSI et l’OWASP.

## Principes de sécurité

La politique doit respecter les principes suivants :

- la longueur du mot de passe constitue le principal critère de sécurité ;
- les phrases de passe longues doivent être acceptées ;
- les règles arbitraires de composition ne doivent pas constituer le mécanisme principal de sécurité ;
- toutes les catégories usuelles de caractères doivent être acceptées ;
- les mots de passe ne doivent jamais être tronqués silencieusement ;
- les mots de passe courants ou compromis doivent être refusés ;
- la même politique doit s’appliquer à la création d’un compte et au changement de mot de passe ;
- la validation doit être réalisée côté serveur et ne doit pas dépendre uniquement du client ;
- la politique de sécurité doit pouvoir être configurée sans modifier la logique métier.

L’implémentation ne doit pas considérer que l’obligation d’utiliser une majuscule, une minuscule, un chiffre et un caractère spécial garantit automatiquement un mot de passe fort.

Ces contraintes peuvent être proposées comme règles optionnelles de compatibilité, mais elles ne doivent pas constituer la politique recommandée par défaut.

## Opérations concernées

La politique de mot de passe doit s’appliquer chaque fois qu’un nouveau mot de passe utilisateur est défini, notamment lors de :

- la création d’un compte ;
- la modification du mot de passe par un utilisateur authentifié ;
- la réinitialisation d’un mot de passe, si ce parcours existe déjà ;
- la définition d’un mot de passe par un administrateur, si cette opération est supportée ;
- la définition d’un mot de passe lors d’une activation de compte ou d’une invitation, si applicable.

Toutes ces opérations doivent s’appuyer sur un même mécanisme centralisé de politique de mot de passe.

## Niveaux de sécurité configurables

L’application doit permettre de configurer plusieurs niveaux de sécurité.

Au minimum, les niveaux suivants doivent pouvoir être représentés.

### Niveau standard

Destiné aux comptes protégés par un facteur d’authentification supplémentaire ou aux applications présentant un niveau de risque modéré.

Caractéristiques recommandées par défaut :

- longueur minimale : 12 caractères ;
- longueur recommandée : au moins 15 caractères ;
- longueur maximale acceptée : au moins 64 caractères ;
- refus des mots de passe courants et compromis ;
- tous les caractères pris en charge sont autorisés ;
- aucune catégorie de caractères obligatoire par défaut.

### Niveau élevé

Destiné aux comptes protégés uniquement par un mot de passe ou donnant accès à des données personnelles ou professionnelles sensibles.

Caractéristiques recommandées par défaut :

- longueur minimale : 15 caractères ;
- longueur maximale acceptée : au moins 64 caractères ;
- refus des mots de passe courants et compromis ;
- refus des mots de passe trop liés au contexte de l’utilisateur lorsque cela est pertinent ;
- tous les caractères pris en charge sont autorisés ;
- les phrases de passe longues sont encouragées ;
- l’évaluation de la robustesse est activée.

### Niveau critique

Destiné aux administrateurs, aux comptes privilégiés, aux opérateurs d’infrastructure ou aux comptes donnant accès à des opérations hautement sensibles.

Caractéristiques recommandées par défaut :

- longueur minimale configurable, avec une valeur recommandée de 20 caractères ;
- longueur maximale acceptée : au moins 64 caractères ;
- refus des mots de passe courants et compromis ;
- refus des mots de passe contextuels ou prévisibles ;
- seuil de robustesse renforcé ;
- authentification multifacteur attendue ou requise par une politique distincte ;
- prévention optionnelle de la réutilisation des anciens mots de passe lorsque l’historique est supporté.

Ces niveaux constituent des valeurs fonctionnelles initiales. L’agent doit déterminer leur représentation technique selon l’architecture de configuration existante.

## Politique personnalisée

L’application doit également permettre de définir une politique personnalisée.

Les propriétés configurables peuvent inclure :

- longueur minimale ;
- longueur maximale acceptée ;
- score minimal de robustesse ;
- activation ou désactivation de la vérification des mots de passe compromis ;
- activation ou désactivation de la vérification des mots de passe courants ;
- activation ou désactivation de la vérification contextuelle ;
- obligation optionnelle d’utiliser une majuscule ;
- obligation optionnelle d’utiliser une minuscule ;
- obligation optionnelle d’utiliser un chiffre ;
- obligation optionnelle d’utiliser un caractère spécial ;
- restriction optionnelle sur les caractères répétés ;
- restriction optionnelle sur les suites de caractères ;
- profondeur optionnelle de l’historique des mots de passe ;
- politique applicable aux utilisateurs standards ;
- politique applicable aux comptes privilégiés ou administrateurs.

L’implémentation doit fournir des valeurs sécurisées par défaut.

La désactivation d’un contrôle de sécurité important doit nécessiter un choix explicite de configuration.

## Politique recommandée par défaut

Sauf si le projet définit déjà une politique plus stricte, la politique par défaut doit être la suivante :

- minimum de 15 caractères Unicode ;
- longueur maximale acceptée d’au moins 64 caractères ;
- aucune obligation de majuscule, minuscule, chiffre ou caractère spécial ;
- espaces acceptés ;
- caractères Unicode acceptés ;
- phrases de passe longues acceptées ;
- aucune suppression ou normalisation silencieuse ;
- aucun tronquage silencieux ;
- refus des mots de passe courants ;
- refus des mots de passe connus comme compromis ;
- refus des mots de passe contenant des informations évidentes liées au compte lorsque cela peut être vérifié de manière fiable ;
- retour de robustesse disponible pour le client ;
- validation identique côté serveur pour la création de compte et le changement de mot de passe.

La longueur maximale peut être supérieure à 64 caractères si l’infrastructure de hachage existante le permet de manière sûre.

## Confirmation du mot de passe

Chaque interface utilisateur ou contrat public permettant de définir un mot de passe doit inclure :

- `password` ;
- `passwordConfirmation`.

Cette exigence s’applique au minimum à :

- la création d’un compte ;
- la modification du mot de passe ;
- la réinitialisation du mot de passe ;
- la définition du mot de passe après une invitation ou une activation de compte.

L’opération doit échouer si les deux valeurs sont différentes.

La confirmation du mot de passe :

- sert uniquement à détecter une erreur de saisie ;
- ne doit pas être persistée ;
- ne doit pas être hachée ;
- ne doit pas être journalisée ;
- ne doit pas être transmise à des composants métier ou de persistance qui n’en ont pas besoin ;
- doit être supprimée après la vérification d’égalité.

Le mot de passe et sa confirmation doivent être comparés exactement, sans normalisation automatique susceptible de modifier leur valeur.

## Comportement lors de la création d’un compte

Lors de la création d’un compte, l’utilisateur doit fournir :

- son mot de passe ;
- la confirmation de ce mot de passe.

Le compte ne doit pas être créé lorsque :

- le mot de passe et sa confirmation sont différents ;
- le mot de passe ne respecte pas la politique active ;
- le mot de passe est identifié comme courant ;
- le mot de passe est identifié comme compromis ;
- le seuil de robustesse configuré n’est pas atteint ;
- une autre validation liée à la création du compte échoue.

La validation doit avoir lieu avant la persistance du mot de passe.

Un échec ne doit pas créer de compte partiel, sauf si l’architecture existante prévoit explicitement un état d’inscription temporaire ou récupérable.

## Comportement lors du changement de mot de passe

Lorsqu’un utilisateur authentifié modifie son mot de passe, il doit fournir :

- son mot de passe actuel, sauf si un autre mécanisme de sécurité préalablement autorisé remplace cette vérification ;
- le nouveau mot de passe ;
- la confirmation du nouveau mot de passe.

L’opération doit échouer lorsque :

- le mot de passe actuel est invalide ;
- le nouveau mot de passe et sa confirmation sont différents ;
- le nouveau mot de passe ne respecte pas la politique active ;
- le nouveau mot de passe est identique au mot de passe actuel, si cette restriction est activée ;
- le nouveau mot de passe apparaît dans l’historique configuré ;
- la vérification des mots de passe compromis le refuse.

Le nouveau mot de passe ne doit remplacer l’ancien qu’après la réussite de toutes les validations.

L’agent doit préserver le comportement transactionnel existant du cas d’usage de changement de mot de passe.

## Évaluation de la robustesse

L’application doit pouvoir évaluer la robustesse probable d’un mot de passe proposé.

Cette évaluation peut prendre en compte :

- la longueur ;
- l’utilisation d’une phrase de passe ;
- les suites prévisibles ;
- les caractères répétés ;
- les motifs de clavier ;
- les substitutions courantes ;
- les mots fréquents ;
- les modèles de mots de passe connus ;
- le contexte du compte ;
- la présence dans des listes de mots de passe compromis.

Le résultat doit pouvoir être représenté de manière stable, par exemple :

- trop faible ;
- faible ;
- acceptable ;
- fort ;
- très fort.

Un score numérique peut être utilisé en interne, mais les contrats publics ne doivent pas dépendre inutilement du modèle d’évaluation d’une bibliothèque spécifique.

La couche domaine ou application ne doit pas dépendre directement d’une bibliothèque particulière d’évaluation de mot de passe.

## Mots de passe courants et compromis

Les mots de passe connus comme courants ou compromis doivent être refusés lorsque le contrôle correspondant est activé.

L’implémentation doit pouvoir s’appuyer sur un ou plusieurs mécanismes parmi les suivants :

- une liste locale de refus ;
- un jeu de données embarqué ou régulièrement mis à jour ;
- un service distant de vérification des mots de passe compromis ;
- un service interne de sécurité exposé via un port applicatif.

Le cœur applicatif ne doit pas dépendre directement d’un fournisseur externe spécifique.

La vérification d’un mot de passe compromis ne doit jamais transmettre le mot de passe complet en clair à un service externe.

L’agent doit utiliser un mécanisme respectueux de la confidentialité proposé par le fournisseur sélectionné ou effectuer la vérification localement.

Le mot de passe en clair ne doit jamais être :

- journalisé ;
- inclus dans les événements de supervision ;
- stocké temporairement en base de données ;
- transmis via un bus d’événements ;
- inclus dans une erreur ;
- retourné dans une réponse API.

## Refus des mots de passe contextuels

Lorsque cette option est activée, le système doit refuser ou pénaliser les mots de passe contenant des informations évidentes liées à l’utilisateur, telles que :

- adresse e-mail ;
- nom d’utilisateur ;
- nom affiché ;
- prénom ;
- nom ;
- nom de l’application ;
- nom de l’organisation.

Cette vérification doit rester proportionnée.

Elle ne doit pas collecter de nouvelles données personnelles uniquement pour analyser le mot de passe.

Elle doit également limiter les faux positifs, notamment pour les noms courts ou les mots très courants.

## Retours de validation

L’utilisateur doit recevoir un retour utile lorsque le mot de passe est refusé.

Les causes fonctionnelles possibles incluent :

- la confirmation ne correspond pas ;
- le mot de passe est trop court ;
- le mot de passe est trop long ;
- le mot de passe est trop courant ;
- le mot de passe apparaît dans une fuite de données connue ;
- le mot de passe est trop prévisible ;
- le mot de passe n’atteint pas le niveau de robustesse requis ;
- le mot de passe ne respecte pas une règle personnalisée ;
- le mot de passe a déjà été utilisé récemment ;
- le mot de passe actuel est incorrect.

L’API doit retourner des codes métier stables et non des messages propres à une bibliothèque technique.

Exemples de codes possibles :

```text
password.confirmation_mismatch
password.too_short
password.too_long
password.too_common
password.compromised
password.too_weak
password.contextual
password.reused
password.current_invalid
```

La nomenclature exacte doit respecter les conventions existantes du projet.

La réponse de validation ne doit pas révéler :

- le mot de passe stocké ;
- le hachage du mot de passe ;
- le contenu exact d’une liste de mots de passe compromis ;
- les paramètres internes de hachage ;
- des informations inutiles sur un autre compte.

## Exigences d’expérience utilisateur

Le client doit pouvoir afficher les exigences de la politique active avant la soumission du formulaire.

Le contrat applicatif doit exposer ou rendre disponibles les informations publiques pertinentes, telles que :

- longueur minimale ;
- longueur maximale ;
- niveau de sécurité ;
- activation de la vérification des mots de passe compromis ;
- règles de composition optionnelles ;
- niveau de robustesse requis.

Le client peut afficher un indicateur de robustesse en temps réel.

Cependant :

- la validation côté serveur reste l’autorité finale ;
- le compte ne doit pas être créé uniquement sur la base d’une validation côté client ;
- le changement de mot de passe ne doit pas réussir uniquement sur la base d’une validation côté client ;
- l’indicateur ne doit pas affirmer qu’un mot de passe est garanti comme sécurisé.

L’utilisateur doit être encouragé à utiliser :

- un mot de passe long et unique ;
- une phrase de passe ;
- un gestionnaire de mots de passe.

## Gestion des caractères

L’implémentation doit :

- accepter les espaces ;
- accepter les caractères Unicode lorsqu’ils sont compatibles avec la plateforme ;
- définir clairement si une normalisation Unicode est effectuée ;
- éviter de supprimer silencieusement les espaces de début ou de fin ;
- éviter tout tronquage silencieux ;
- garantir un traitement identique entre création, hachage, authentification et changement de mot de passe ;
- garantir que la longueur maximale est compatible avec l’algorithme de hachage utilisé.

La notion de longueur doit être définie de manière cohérente.

L’agent doit déterminer explicitement si le projet mesure :

- les points de code Unicode ;
- les graphèmes ;
- les octets encodés.

La règle choisie doit être documentée et appliquée de manière identique dans tous les flux.

## Stockage des mots de passe

Cette tâche doit préserver ou améliorer la sécurité du stockage des mots de passe.

Les mots de passe doivent :

- être traités via le port de hachage existant ou une abstraction équivalente ;
- ne jamais être stockés en clair ;
- ne jamais être stockés avec un chiffrement réversible ;
- utiliser un algorithme adapté au stockage des mots de passe ;
- utiliser des sels uniques selon le mécanisme sélectionné ;
- utiliser des paramètres adaptés à l’environnement de déploiement.

Le cœur applicatif doit rester indépendant de l’implémentation de hachage.

Si Argon2id, bcrypt, scrypt ou une autre implémentation est déjà disponible via un adaptateur d’infrastructure, l’agent doit vérifier :

- que l’implémentation supporte la longueur maximale configurée ;
- qu’elle ne tronque pas silencieusement le mot de passe ;
- que ses paramètres de coût sont adaptés ;
- que la vérification reste compatible avec les hachages existants.

Cette spécification n’impose pas le remplacement de l’algorithme actuel sauf si celui-ci est insuffisamment sécurisé ou incompatible avec les nouvelles exigences.

## Configuration et architecture

La politique de mot de passe doit être représentée comme un concept métier ou applicatif indépendant de :

- HTTP ;
- bibliothèques de variables d’environnement ;
- frameworks de configuration ;
- bibliothèques d’évaluation de robustesse ;
- fournisseurs de mots de passe compromis ;
- bibliothèques de hachage.

La configuration d’infrastructure peut construire la politique active.

L’agent doit analyser le projet pour déterminer le placement le plus cohérent de :

- la politique de mot de passe ;
- le validateur de mot de passe ;
- l’évaluateur de robustesse ;
- le vérificateur de mots de passe compromis ;
- le vérificateur de mots de passe courants ;
- le vérificateur d’historique ;
- le service de hachage.

L’implémentation doit éviter toute duplication des règles entre :

- création de compte ;
- changement de mot de passe ;
- réinitialisation ;
- opérations administratives.

## Mots de passe existants

L’introduction de la nouvelle politique ne doit pas invalider automatiquement les mots de passe existants.

Les utilisateurs existants doivent pouvoir continuer à s’authentifier avec leur mot de passe actuel.

La nouvelle politique s’applique lorsqu’un mot de passe est :

- créé ;
- modifié ;
- réinitialisé ;
- renouvelé explicitement par l’application.

Une migration ou une politique de renouvellement forcé pourra être définie ultérieurement si nécessaire.

## Indisponibilité des services externes

Si la vérification des mots de passe compromis dépend d’un service externe, le comportement en cas d’indisponibilité doit être configurable.

Les stratégies possibles incluent :

- échec fermé : refuser la définition du mot de passe tant que la vérification est indisponible ;
- échec ouvert avec journalisation de sécurité : autoriser l’opération mais signaler que la vérification n’a pas pu être effectuée ;
- utilisation d’une liste locale de secours.

La stratégie par défaut doit être choisie en fonction du niveau de risque de l’application.

Le mot de passe ne doit jamais apparaître dans les erreurs ou les journaux de sécurité.

## Audit et journalisation

L’application peut enregistrer des événements de sécurité tels que :

- changement de mot de passe réussi ;
- réinitialisation réussie ;
- refus d’un mot de passe compromis ;
- indisponibilité du service de vérification ;
- tentatives répétées de modification.

Les événements d’audit doivent contenir uniquement les métadonnées nécessaires.

Ils ne doivent jamais contenir :

- le mot de passe en clair ;
- la confirmation ;
- le hachage ;
- un fragment du mot de passe ;
- des données permettant de le reconstruire.

## Limitation du nombre de tentatives

L’agent doit vérifier que les opérations sensibles sont protégées contre les abus.

Cela inclut notamment :

- les tentatives de changement de mot de passe ;
- la vérification du mot de passe actuel ;
- les tentatives de réinitialisation ;
- les appels à un service externe de vérification.

Si cette responsabilité appartient à un autre module, l’agent doit documenter cette dépendance sans dupliquer le mécanisme.

## Modèle fonctionnel

L’implémentation doit permettre de représenter des concepts équivalents à :

```text
PasswordPolicy
- niveau de sécurité
- longueur minimale
- longueur maximale
- robustesse minimale
- vérification des mots de passe compromis
- vérification des mots de passe courants
- vérification contextuelle
- règles de composition optionnelles
- historique optionnel
```

```text
PasswordValidationResult
- valide ou invalide
- catégorie de robustesse
- erreurs métier de validation
```

```text
DefinePasswordInput
- mot de passe
- confirmation du mot de passe
```

Le modèle technique exact doit respecter l’architecture et les conventions de nommage existantes.

## Travail demandé

1. Analyser tous les flux existants permettant de définir ou remplacer un mot de passe.
2. Identifier le value object actuel, le port de hachage, les implémentations d’infrastructure, les contrats, les cas d’usage et les codes d’erreur.
3. Définir un modèle centralisé et configurable de politique de mot de passe.
4. Fournir des niveaux de sécurité sécurisés par défaut.
5. Appliquer la politique à la création d’un compte.
6. Appliquer la même politique au changement de mot de passe.
7. Appliquer la politique à la réinitialisation et aux invitations lorsque ces parcours existent.
8. Ajouter le champ de confirmation dans les contrats d’entrée concernés.
9. Refuser l’opération lorsque le mot de passe et sa confirmation diffèrent.
10. Ajouter des vérifications des mots de passe courants et compromis derrière des abstractions adaptées.
11. Ajouter un mécanisme d’évaluation de robustesse sans coupler le cœur applicatif à une bibliothèque.
12. Exposer les exigences publiques nécessaires aux clients.
13. Préserver la compatibilité avec les comptes et les hachages existants.
14. Ajouter des codes de succès et d’erreur stables selon les conventions du projet.
15. Ajouter les tests unitaires, d’intégration, de contrat et de sécurité pertinents.
16. Mettre à jour la documentation du module.
17. Documenter les options de configuration, les valeurs par défaut et les dépendances d’infrastructure.
18. Signaler toute modification incompatible d’un contrat public.

## Critères d’acceptation

La tâche est terminée lorsque :

- la création d’un compte exige un mot de passe et sa confirmation ;
- le changement de mot de passe exige un nouveau mot de passe et sa confirmation ;
- la réinitialisation exige une confirmation lorsque ce parcours existe ;
- les valeurs différentes sont refusées ;
- la confirmation n’est jamais persistée ni journalisée ;
- la même politique centralisée s’applique à tous les flux ;
- le niveau de sécurité actif est configurable ;
- des niveaux sécurisés par défaut sont disponibles ;
- la politique par défaut exige au moins 15 caractères ;
- au moins 64 caractères sont acceptés ;
- les phrases de passe longues sont acceptées ;
- les espaces et caractères Unicode pris en charge sont acceptés ;
- aucun mot de passe n’est tronqué silencieusement ;
- les mots de passe courants peuvent être refusés ;
- les mots de passe compromis peuvent être refusés ;
- la robustesse peut être évaluée et exposée via un contrat stable ;
- les règles de composition sont optionnelles et non imposées par défaut ;
- les retours côté client sont possibles mais la validation serveur reste autoritaire ;
- les mots de passe existants restent valides tant qu’ils ne sont pas modifiés ;
- aucun mot de passe, confirmation ou hachage n’apparaît dans les journaux ou les erreurs ;
- la création de compte et le changement de mot de passe sont couverts par des tests ;
- les options de configuration et les choix de sécurité sont documentés.

## Scénarios de test

Les tests doivent couvrir au minimum :

1. création d’un compte avec un mot de passe valide et une confirmation identique ;
2. création avec une confirmation différente ;
3. création avec un mot de passe trop court ;
4. création avec une phrase de passe longue ;
5. création avec des espaces ;
6. création avec des caractères Unicode pris en charge ;
7. refus d’un mot de passe courant ;
8. refus d’un mot de passe compromis ;
9. comportement lorsque le service de vérification est indisponible ;
10. changement avec un mot de passe actuel valide ;
11. changement avec un mot de passe actuel invalide ;
12. changement avec une confirmation différente ;
13. changement avec un nouveau mot de passe trop faible ;
14. changement avec la politique de niveau élevé ;
15. changement avec une politique personnalisée ;
16. acceptation de la longueur maximale configurée ;
17. refus au-delà de la longueur maximale ;
18. vérification qu’aucun mot de passe ou confirmation n’est persisté en clair ;
19. vérification qu’aucun mot de passe n’apparaît dans les journaux ;
20. authentification avec un mot de passe créé avant la nouvelle politique ;
21. validation cohérente entre création et changement ;
22. politique plus stricte pour les comptes privilégiés lorsque cela est configuré.

## Hors périmètre

Sauf nécessité imposée par l’architecture existante, cette tâche n’inclut pas :

- l’implémentation de l’authentification multifacteur ;
- l’obligation pour tous les utilisateurs existants de changer immédiatement leur mot de passe ;
- la création complète d’un parcours de réinitialisation s’il n’existe pas ;
- le développement complet de l’interface graphique ;
- la création d’un gestionnaire de mots de passe ;
- la rotation automatique et périodique des mots de passe ;
- l’envoi de rappels d’expiration ;
- le remplacement de l’algorithme de hachage actuel sans nécessité démontrée.

L’objectif est d’établir une politique de mot de passe centralisée, configurable, moderne et appliquée de manière cohérente à toutes les opérations définissant un mot de passe utilisateur.
