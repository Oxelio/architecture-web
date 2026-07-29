# Export et suppression des données du compte

> **Identifiant :** SF-ACCOUNT-DATA-001
>
> **Statut :** Acceptée
>
> **Dépendances fonctionnelles :**
> [SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md),
> [SF-SESSION-001](SF-SESSION-001.md)

## Contexte métier

Un utilisateur peut administrer ses identifiants et ses sessions, mais il ne
peut ni obtenir une copie structurée des données associées à son compte, ni
demander sa suppression. Les données IAM sont réparties entre la persistance
utilisateur, les sessions, les vérifications et, à terme, le journal d’audit.

## Objectif fonctionnel

Permettre à un utilisateur :

1. de demander un export compréhensible et portable de ses données ;
2. de télécharger cet export de manière sécurisée ;
3. de demander la suppression de son compte ;
4. d’annuler cette demande pendant une période de grâce ;
5. de connaître clairement les données supprimées, anonymisées ou conservées.

Cette spécification définit un comportement de produit. La conformité juridique
finale dépend du contexte de déploiement et doit être validée séparément.

## Autorisation renforcée

L’export et la suppression nécessitent une session authentifiée récente et une
nouvelle vérification du mot de passe. Si le MFA est actif, un second facteur
valide est également exigé.

Ces opérations sont limitées en fréquence et auditées. Un administrateur ne peut
pas télécharger l’export personnel d’un utilisateur ni supprimer son compte à
sa place au moyen de ce parcours.

## Export

L’utilisateur peut demander une archive contenant au minimum :

- identifiant, adresse e-mail, rôle, statut et dates du compte ;
- état de vérification de l’adresse ;
- sessions et métadonnées de session encore conservées ;
- événements de sécurité accessibles à l’utilisateur ;
- historique des demandes d’export et de suppression encore conservé.

L’archive n’inclut jamais :

- mot de passe haché ;
- jeton ou cookie ;
- secret MFA ou dérivé de code de secours ;
- données appartenant à un autre utilisateur ;
- notes ou métadonnées internes non communicables ;
- secrets de configuration et journaux techniques bruts.

Le format initial est une archive ZIP contenant des fichiers JSON UTF-8
documentés et versionnés. Les dates utilisent un format non ambigu et les champs
absents sont distingués des valeurs inconnues.

## Génération et téléchargement

La génération peut être asynchrone. Une demande possède les états `pending`,
`ready`, `expired` ou `failed`.

Lorsque l’archive est prête :

- l’utilisateur reçoit une notification sans pièce jointe ;
- le téléchargement exige une authentification valide ;
- le lien expire après 24 heures ;
- l’archive est supprimée à l’expiration ou après le premier téléchargement
  réussi ;
- aucune URL durable ou publiquement partageable n’est produite.

Une nouvelle demande ne doit pas multiplier inutilement les archives
concurrentes. Un échec n’expose pas les détails internes de génération.

## Demande de suppression

Avant confirmation, l’interface explique :

- la durée de la période de grâce ;
- la perte d’accès immédiate ;
- les données destinées à être supprimées ;
- les données éventuellement conservées et leur justification ;
- les conséquences pour un compte administrateur.

Après la vérification renforcée, l’utilisateur confirme explicitement la
suppression. Le compte passe alors en attente de suppression pendant 14 jours :

- toutes les sessions sont révoquées ;
- aucune connexion normale n’est autorisée ;
- les jetons actifs sont invalidés ;
- aucun nouvel export ne peut être demandé ;
- un message de confirmation et d’annulation est envoyé à l’adresse vérifiée.

La durée de grâce est configurable. La suppression définitive n’a lieu qu’après
son expiration.

## Annulation

Pendant la période de grâce, le propriétaire peut annuler au moyen d’un lien
temporaire envoyé à l’adresse vérifiée et d’une vérification renforcée. Le jeton
d’annulation est à usage unique, expire au plus tard avec la période de grâce et
respecte les mêmes exigences de confidentialité que les jetons de récupération.

L’annulation réactive l’accès selon le statut antérieur du compte, sans restaurer
les sessions révoquées. Un compte qui était suspendu reste suspendu.

## Suppression définitive

À l’échéance, le système supprime :

- le compte et ses identifiants actifs ;
- le mot de passe haché ;
- les sessions ;
- les jetons de vérification, récupération et annulation ;
- les secrets MFA et codes de secours ;
- les archives d’export ;
- les données techniques sans obligation de conservation.

Les événements d’audit encore nécessaires sont conservés seulement jusqu’à
leur échéance, conformément à
[SF-SECURITY-AUDIT-001](SF-SECURITY-AUDIT-001.md), avec suppression ou
pseudonymisation des références directes au compte.

Une obligation légale documentée peut retarder la suppression de certaines
données. L’utilisateur doit être informé de cette possibilité sans recevoir
d’information susceptible de compromettre une investigation.

## Comptes administrateurs et dépendances

Le dernier administrateur actif ne peut pas demander sa suppression tant qu’un
autre administrateur actif n’existe pas. Le refus explique l’action corrective
sans exposer d’autre compte.

Si le compte possède ultérieurement des ressources dans d’autres bounded
contexts, chacun doit déclarer sa politique : suppression, anonymisation,
transfert ou blocage motivé. L’IAM ne doit pas annoncer une suppression complète
avant que ces traitements soient terminés.

## Scénarios de test

Les tests couvrent au minimum :

1. vérification renforcée pour export et suppression ;
2. contenu attendu de l’archive et exclusion de tous les secrets ;
3. isolement strict entre utilisateurs ;
4. états de génération, échec et expiration ;
5. téléchargement unique et suppression de l’archive ;
6. révocation immédiate des sessions lors d’une demande de suppression ;
7. impossibilité de se connecter pendant la période de grâce ;
8. annulation valide, expirée, rejouée et concernant un compte suspendu ;
9. suppression définitive de chaque catégorie de données ;
10. pseudonymisation et rétention bornée des audits ;
11. refus pour le dernier administrateur actif ;
12. idempotence des traitements planifiés ;
13. notifications et événements d’audit ;
14. comportement explicite en présence d’une obligation de conservation.

## Critères d’acceptation

La fonctionnalité est terminée lorsque l’utilisateur peut obtenir une archive
portable sans secret, que le téléchargement est temporaire et protégé, que la
suppression révoque immédiatement l’accès, qu’elle peut être annulée pendant la
période de grâce, que l’effacement final traite toutes les données déclarées et
que toute conservation restante est bornée et expliquée.

## Hors périmètre

Cette spécification n’inclut pas :

- une conclusion juridique sur la conformité d’un déploiement ;
- l’export des données d’un autre utilisateur par un administrateur ;
- le transfert automatique de propriété de futures ressources métier ;
- la restauration après suppression définitive ;
- la suppression des sauvegardes avant leur cycle normal de rotation ;
- un portail de traitement des demandes légales par un opérateur.
