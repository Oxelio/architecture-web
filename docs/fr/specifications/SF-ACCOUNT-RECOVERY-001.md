# Récupération de compte et réinitialisation du mot de passe

> **Identifiant :** SF-ACCOUNT-RECOVERY-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-PASSWORD-001](SF-PASSWORD-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Contexte métier

Un utilisateur peut créer un compte, vérifier son adresse, se connecter et
modifier son mot de passe lorsqu’il connaît encore le mot de passe actuel.
Il ne peut cependant pas récupérer son compte s’il l’a oublié.

Ce parcours manquant peut rendre un compte définitivement inaccessible. Il doit
être ajouté sans permettre de découvrir si une adresse est inscrite, sans
affaiblir la politique de mot de passe et sans laisser actives des sessions
potentiellement compromises.

## Objectif fonctionnel

Permettre au propriétaire d’une adresse e-mail associée à un compte de définir
un nouveau mot de passe au moyen d’un lien temporaire, confidentiel et à usage
unique.

Le parcours comprend :

1. la demande de récupération ;
2. l’envoi éventuel d’un message ;
3. la validation d’un jeton temporaire ;
4. la définition du nouveau mot de passe ;
5. la révocation des sessions existantes ;
6. la notification du changement.

## Acteurs

- un visiteur non authentifié qui demande une récupération ;
- le propriétaire de la boîte e-mail qui utilise le lien reçu ;
- le système de messagerie ;
- un administrateur, uniquement pour consulter les événements autorisés : il ne
  peut ni lire un jeton ni choisir un mot de passe à la place de l’utilisateur.

## Demande de récupération

La demande reçoit une adresse e-mail. Après une validation syntaxique minimale,
la réponse publique doit rester identique lorsque :

- l’adresse n’appartient à aucun compte ;
- le compte est suspendu ;
- l’adresse n’est pas encore vérifiée ;
- une demande récente existe déjà ;
- l’envoi du message est volontairement limité.

La réponse confirme seulement que des instructions seront envoyées si le compte
est éligible. Elle ne retourne ni identifiant utilisateur, ni statut, ni délai
précis permettant d’inférer l’existence du compte.

Les demandes doivent être limitées par compte lorsqu’il est connu et par origine
technique. Les seuils sont configurables. Un abus ne doit pas provoquer l’envoi
illimité de messages ni bloquer durablement un utilisateur légitime.

## Jeton de réinitialisation

Pour un compte éligible, le système génère un jeton aléatoire distinct des
jetons de session et de vérification d’adresse.

Le jeton :

- expire initialement après 30 minutes, durée rendue configurable ;
- ne peut être utilisé qu’une seule fois ;
- est invalidé par l’émission d’un nouveau jeton pour le même compte ;
- n’est jamais persisté, journalisé ou transmis à un tiers sous sa forme
  exploitable ;
- ne révèle aucune donnée du compte ;
- est comparé au moyen d’une représentation non réversible.

La consommation du jeton et l’enregistrement du nouveau mot de passe doivent
former une opération cohérente : deux utilisations concurrentes ne peuvent pas
réussir.

Les erreurs publiques pour un jeton inconnu, expiré, consommé ou invalidé
doivent être équivalentes.

## Définition du nouveau mot de passe

L’utilisateur fournit le nouveau mot de passe et sa confirmation. La politique
de [SF-PASSWORD-001](SF-PASSWORD-001.md) s’applique avec le niveau correspondant
au rôle du compte.

Une réinitialisation réussie :

- remplace le mot de passe ;
- consomme le jeton ;
- révoque toutes les sessions du compte ;
- ne connecte pas automatiquement l’utilisateur ;
- invite l’utilisateur à se reconnecter ;
- déclenche un message de confirmation dépourvu de secret.

La confirmation par e-mail ne doit contenir ni mot de passe, ni jeton de
session. Elle indique comment réagir si le propriétaire n’est pas à l’origine
du changement.

## Comptes particuliers

- Un compte suspendu peut remplacer son mot de passe avec un jeton valide, mais
  reste suspendu et ne peut pas se connecter.
- La réinitialisation ne vérifie pas implicitement une adresse non vérifiée.
- Un changement d’adresse invalide tout jeton envoyé à l’ancienne adresse.
- Un changement de mot de passe réalisé depuis une session authentifiée invalide
  les jetons de récupération encore actifs.
- La suppression ou la mise en attente de suppression d’un compte invalide ses
  jetons.

## Sécurité et confidentialité

Les journaux ne doivent contenir ni mot de passe, ni confirmation, ni jeton
exploitable. Les événements de sécurité peuvent contenir le résultat, la date,
une référence de compte non publique et les informations réseau strictement
nécessaires.

Le système doit limiter les différences observables de contenu et de statut
HTTP entre comptes connus et inconnus. Il n’est pas exigé de garantir un temps
de réponse rigoureusement constant, mais aucune branche ne doit volontairement
faciliter l’énumération.

## Expérience utilisateur

L’interface doit proposer :

- un lien « Mot de passe oublié » depuis la connexion ;
- un formulaire de demande avec une confirmation générique ;
- une page de choix du nouveau mot de passe ;
- les exigences de mot de passe existantes et la confirmation ;
- un état clair lorsque le lien n’est plus utilisable ;
- un retour vers la connexion après succès.

Un rafraîchissement ou un double clic ne doit pas présenter une seconde
réinitialisation comme réussie.

## Scénarios de test

Les tests couvrent au minimum :

1. demande pour un compte connu et un compte inconnu avec réponse équivalente ;
2. limitation des demandes répétées ;
3. expiration, invalidation et usage unique du jeton ;
4. invalidation du précédent jeton après une nouvelle demande ;
5. refus de deux mots de passe différents ;
6. application de la politique normale et privilégiée ;
7. réussite atomique face à deux consommations concurrentes ;
8. révocation de toutes les sessions ;
9. absence de connexion automatique ;
10. maintien de la suspension ;
11. absence de vérification implicite de l’adresse ;
12. invalidation après changement d’adresse, changement authentifié du mot de
    passe ou suppression ;
13. absence de secrets dans les réponses, messages et journaux.

## Critères d’acceptation

La fonctionnalité est terminée lorsque le parcours complet est utilisable sans
révéler l’existence d’un compte, que chaque jeton est temporaire et à usage
unique, que la politique de mot de passe est réutilisée, que toutes les sessions
sont révoquées après succès et que les cas de concurrence et d’abus sont
couverts par des tests.

## Hors périmètre

Cette spécification n’inclut pas :

- la récupération d’une boîte e-mail perdue ;
- la désactivation d’un second facteur perdu ;
- la définition d’un mot de passe par un administrateur ;
- les questions secrètes ;
- l’authentification automatique après réinitialisation ;
- une procédure manuelle de preuve d’identité.
