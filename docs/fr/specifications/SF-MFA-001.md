# Authentification multifacteur par application d’authentification

> **Identifiant :** SF-MFA-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-ACCOUNT-RECOVERY-001](SF-ACCOUNT-RECOVERY-001.md),
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Contexte métier

L’authentification repose actuellement sur un mot de passe. La compromission de
ce seul secret suffit donc à ouvrir une session. Les comptes administrateurs
présentent un risque particulier en raison de leurs permissions.

## Objectif fonctionnel

Permettre à un utilisateur d’ajouter un second facteur fondé sur une application
d’authentification compatible TOTP. Fournir des codes de secours pour éviter
qu’une perte temporaire de l’application ne rende immédiatement le compte
irrécupérable.

La première version doit rendre le MFA facultatif pour les comptes ordinaires et
permettre de l’exiger pour les administrateurs par politique de déploiement.

## Enrôlement

L’enrôlement nécessite :

1. une session authentifiée récente ;
2. une nouvelle vérification du mot de passe ;
3. la génération d’un secret TOTP ;
4. la présentation du secret sous forme de QR code et de valeur manuelle ;
5. la saisie d’un premier code valide ;
6. la génération de codes de secours ;
7. la confirmation explicite de leur sauvegarde.

Le MFA ne devient actif qu’après validation du premier code. Un enrôlement
abandonné ou expiré ne doit pas modifier le compte.

Le secret TOTP n’est affiché que pendant l’enrôlement. Il est chiffré au repos et
n’est jamais retourné après activation.

## Codes de secours

Le système génère initialement dix codes de secours indépendants :

- chaque code est utilisable une seule fois ;
- seuls des dérivés non réversibles sont conservés ;
- les codes en clair ne sont affichés qu’une seule fois ;
- leur régénération invalide immédiatement tous les anciens codes ;
- l’utilisateur peut voir le nombre de codes restants, jamais leur valeur.

L’utilisation ou la régénération des codes déclenche un événement de sécurité.
Un avertissement est présenté lorsque leur nombre devient faible.

## Connexion avec MFA

Après validation du mot de passe, un compte protégé n’obtient pas encore de
session authentifiée complète. Il doit présenter :

- un code TOTP valide ; ou
- un code de secours inutilisé.

Le challenge est temporaire, lié au parcours de connexion et inutilisable pour
les autres opérations de l’API. Les tentatives sont limitées et un nouveau mot
de passe correct ne doit pas permettre de contourner cette limitation.

Les erreurs ne précisent pas si le code était presque valide, déjà utilisé ou
associé à un autre compte. Une tolérance temporelle limitée peut compenser un
léger décalage d’horloge sans accepter plusieurs fois le même code dans un même
challenge.

La fonction « appareil de confiance » n’est pas incluse dans cette version :
chaque nouvelle session exige le second facteur.

## Gestion et désactivation

Un utilisateur peut consulter l’état du MFA, la date d’activation et le nombre
de codes de secours restants.

La régénération des codes exige une authentification récente, le mot de passe et
un second facteur valide.

La désactivation exige également le mot de passe et un second facteur valide.
Elle révoque toutes les sessions, consomme le challenge courant et impose une
nouvelle connexion. Une politique qui impose le MFA au rôle administrateur doit
refuser la désactivation tant que ce rôle est conservé.

L’activation révoque les autres sessions du compte afin qu’elles ne restent pas
durablement ouvertes sans avoir satisfait le nouveau niveau de protection.

## Interaction avec les autres parcours

- Une réinitialisation de mot de passe ne désactive jamais le MFA.
- Un changement d’adresse ne désactive jamais le MFA.
- Une suspension conserve la configuration MFA.
- La suppression du compte supprime le secret et les dérivés des codes.
- Un changement vers un rôle soumis au MFA peut créer une période
  d’enrôlement limitée ; à son expiration, aucune nouvelle session complète
  n’est autorisée avant activation.
- La perte simultanée du mot de passe, de l’application et des codes de secours
  nécessite une procédure de récupération renforcée distincte.

## Notifications et audit

L’utilisateur reçoit une notification sans secret après :

- activation ou désactivation ;
- régénération des codes de secours ;
- utilisation d’un code de secours ;
- échecs répétés pouvant indiquer une attaque.

Les événements correspondants suivent
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md).

## Scénarios de test

Les tests couvrent au minimum :

1. enrôlement complet et abandon sans activation ;
2. refus lorsque la session ou la vérification du mot de passe n’est plus
   récente ;
3. secret non exposé après activation ;
4. connexion impossible sans second facteur ;
5. code TOTP valide, invalide, expiré et rejoué ;
6. limitation des tentatives ;
7. utilisation unique des dix codes de secours ;
8. invalidation de tous les anciens codes après régénération ;
9. désactivation avec vérifications requises ;
10. refus de désactivation pour un rôle soumis à la politique ;
11. révocation des sessions lors de l’activation ou de la désactivation ;
12. maintien du MFA après réinitialisation du mot de passe ;
13. suppression des secrets avec le compte ;
14. notifications et événements dépourvus de secrets.

## Critères d’acceptation

La fonctionnalité est terminée lorsque l’enrôlement exige la preuve du premier
code, qu’aucune session complète n’est créée sans second facteur, que les codes
de secours sont à usage unique, que les secrets sont protégés, que les
politiques de rôle sont respectées et que tous les changements sensibles sont
notifiés et audités.

## Hors périmètre

Cette spécification n’inclut pas :

- SMS ou e-mail comme second facteur ;
- WebAuthn, passkeys ou clés matérielles ;
- appareils de confiance ;
- approbation push ;
- récupération manuelle par le support ;
- politiques adaptatives fondées sur le risque ;
- fédération avec un fournisseur d’identité externe.
