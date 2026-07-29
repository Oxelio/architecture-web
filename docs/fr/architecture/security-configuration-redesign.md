# Refonte de la configuration de sécurité

## Statut et portée

Ce document est un diagnostic d’architecture et un plan de reprise. Le
comportement fonctionnel attendu reste défini par
[SF-SECURITY-CONFIG-001](../specifications/SF-SECURITY-CONFIG-001.md). Ce
document sépare les faits observés, les règles cibles et les travaux à réaliser
afin de ne pas présenter une recommandation comme déjà implémentée.

Le périmètre porte sur le centre de configuration de sécurité, ses consommateurs
et les règles configurables qui se trouvent actuellement dans des objets métier
ou des composants techniques.

Les « faits observés » ci-dessous décrivent le point de départ de la refonte.
Leur état courant est suivi ici :

| Chantier                             | État actuel                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| formulaire typé et catalogue         | implémenté ; vérification email explicitement en lecture seule                  |
| policy de mot de passe unique        | implémentée via `IamPolicyProvider` ; récupération encore limitée aux longueurs |
| durée de session injectée            | implémentée pour connexion directe et finalisation MFA                          |
| schéma de validation unique          | implémenté dans `security-policy.ts`                                            |
| capacités dans les cas d’utilisation | implémenté pour inscription, adresse email et sessions personnelles             |
| contrat public de capacités          | implémenté par `GET /v1/iam/capabilities`                                       |
| publication renforcée                | motif, aperçu, confirmation et restauration implémentés                         |
| réauthentification forte             | à faire                                                                         |
| état de propagation multi-instance   | à faire                                                                         |

## Diagnostic

### 1. L’interface expose le format de stockage

**Fait observé.** `AdminSecurityCenter` affiche toute la policy dans un
`textarea` JSON. L’administrateur doit connaître les clés internes, les types,
les unités et les dépendances. Une erreur de syntaxe ou de valeur produit un
message générique, sans rattachement au champ concerné.

Le catalogue retourné par l’API ne contient que `key`, `type`, `impact` et
`available`. Il ne fournit ni libellé, description, catégorie, unité, bornes,
choix, valeur recommandée, dépendances ou motif d’indisponibilité. Il ne permet
donc pas à un client de construire un formulaire compréhensible et accessible.

**Décision cible.** L’interface d’administration **DOIT** éditer un brouillon
typé au moyen de contrôles adaptés. Le JSON peut rester un contrat de transport,
mais il **NE DOIT PAS** être l’interface utilisateur principale.

### 2. Le catalogue affirme des capacités qui ne sont pas effectives

**Fait observé.** Toutes les entrées de `SECURITY_CONFIG_CATALOG` sont retournées
avec `available: true`. Pourtant :

- `accounts.emailVerification` ne pilote aucun parcours ;
- `sessions.durationMinutes` n’est pas utilisé lors de la création d’une
  session ;
- les longueurs dynamiques de mot de passe ne s’appliquent qu’à la
  réinitialisation par récupération ;
- l’inscription, le changement authentifié et le contrat public de policy
  utilisent encore une policy construite depuis l’environnement au démarrage.

L’interface peut donc confirmer une publication sans que la valeur soit
effectivement appliquée partout.

**Décision cible.** Une option **NE DOIT PAS** être modifiable tant qu’un
consommateur exécutable et un test d’intégration ne démontrent pas son effet.
Le catalogue **DOIT** distinguer `available`, `readOnly`, `effective` et
`pending`, avec un motif stable lorsque l’option est indisponible.

### 3. Deux sources de vérité pilotent les mots de passe

**Fait observé.** Le `PasswordPolicyValidator` utilisé par l’inscription, le
changement de mot de passe et l’API publique est construit au démarrage depuis
les variables `PASSWORD_*`. `SecurityService` relit séparément une policy
persistée et n’en applique que les longueurs lors de la récupération.

Le value object `PasswordPlainValueObject` est déjà permissif : il vérifie
seulement la présence et une borne défensive de transport de 1024 points de
code. Il ne contient plus de longueur minimale métier. Cette séparation est
correcte et doit devenir une règle explicite pour éviter une régression.

**Décision cible.**

- `PasswordPlainValueObject` **DOIT** garantir uniquement les invariants
  intrinsèques et défensifs nécessaires pour représenter une valeur ;
- la policy active **DOIT** être l’unique propriétaire des longueurs minimales
  et maximales fonctionnelles, de la robustesse et des contrôles optionnels ;
- tous les cas d’utilisation qui créent ou remplacent un mot de passe
  **DOIVENT** recevoir le même fournisseur de policy par révision ;
- l’authentification **NE DOIT PAS** réévaluer un mot de passe historique avec
  la policy de création courante ;
- après migration, les variables `PASSWORD_*` **NE DOIVENT** servir qu’à
  initialiser la première révision, puis devenir obsolètes.

### 4. La durée de session est placée au mauvais niveau

**Fait observé.** `SessionEntity.createForUser` calcule l’expiration avec une
constante privée de 60 minutes. Le centre expose parallèlement
`sessions.durationMinutes`, dont la valeur par défaut est 30 jours. Cette
situation est conceptuellement identique à une longueur minimale de mot de
passe codée dans son value object : l’entité possède une règle que la policy
prétend définir.

**Décision cible.** La durée effective **DOIT** être résolue par le cas
d’utilisation ou un fournisseur de policy, puis transmise à l’entité sous la
forme d’une date d’expiration. L’entité **DOIT** contrôler la cohérence de cette
date, mais **NE DOIT PAS** choisir une durée configurable.

### 5. Les règles de configuration sont dupliquées et incomplètes

**Fait observé.** Les valeurs de mot de passe sont validées dans la configuration
Zod de démarrage, dans `createPasswordPolicy` et dans
`SecurityService.validatePolicy`. Ce dernier valide certaines bornes et
dépendances, mais ne vérifie pas explicitement le type des booléens. Le type
TypeScript ne protège pas les données JSON reçues à l’exécution.

**Décision cible.** Un schéma de policy versionné **DOIT** être la source unique
des types, bornes, choix et dépendances. Il **DOIT** valider les lectures depuis
HTTP et la persistance. Les métadonnées publiques du formulaire **DEVRAIENT**
être dérivées du même catalogue afin d’éviter la dérive entre validation et
affichage.

### 6. L’activation des fonctionnalités fuit dans la couche HTTP

**Fait observé.** Certaines options sont appliquées par un hook global qui
reconnaît des fragments d’URL. D’autres sont vérifiées dans `SecurityService`.
Le client utilisateur ne reçoit pas un état de capacités commun lui permettant
de masquer ou désactiver les parcours concernés.

Une nouvelle route ou une route renommée peut ainsi contourner involontairement
le hook, et une fonctionnalité désactivée peut rester proposée dans
l’interface avant d’échouer avec `FEATURE_DISABLED`.

**Décision cible.** Chaque cas d’utilisation optionnel **DOIT** vérifier une
capacité métier stable. La couche HTTP **PEUT** effectuer un rejet anticipé,
mais ne doit pas être l’unique contrôle. Un contrat public minimal **DOIT**
exposer les capacités nécessaires au rendu des parcours utilisateur.

### 7. Le parcours de publication est incomplet

**Fait observé.**

- le motif de changement est facultatif et peut être vide ;
- la prévisualisation ne présente pas systématiquement les valeurs avant/après ;
- aucune confirmation renforcée n’est demandée pour une réduction critique ;
- l’écran n’affiche ni l’auteur, ni le motif, ni le détail des révisions et ne
  propose pas la restauration pourtant exposée par l’API ;
- l’état publié n’est pas distingué d’un état effectivement propagé ;
- les libellés du composant sont codés en français dans une application
  bilingue ;
- le journal d’audit et l’éditeur occupent le même composant sans navigation
  dédiée.

**Décision cible.** L’administration **DOIT** posséder une page dédiée avec
brouillon local, validation par champ, prévisualisation structurée, motif
obligatoire, confirmation renforcée selon l’impact, gestion explicite des
conflits de version et historique restaurable. L’audit reste accessible depuis
cette page, mais constitue une vue distincte.

## Contrat de catalogue cible

Chaque entrée du catalogue devrait permettre de rendre le formulaire sans
connaître une clé en dur :

```text
key, category, labelKey, descriptionKey
control: switch | number | slider-number | select | multi-select
constraints: min, max, step, unit, choices
recommendedValue, initialValue, publishedValue, effectiveValue
availability: available, readOnly, reason
impact, dependencies, incompatibilities, effectMode
```

Le contrôle recommandé dépend de la nature de la valeur :

| Valeur                         | Contrôle principal                                    |
| ------------------------------ | ----------------------------------------------------- |
| activation                     | interrupteur avec conséquence immédiate visible       |
| durée ou entier à plage courte | slider couplé à un champ numérique éditable           |
| durée à plage large            | champ numérique et sélecteur d’unité                  |
| niveau fermé                   | boutons radio ou cartes de choix                      |
| rôles concernés                | cases à cocher ou sélection multiple                  |
| valeur critique                | contrôle normal puis confirmation renforcée à publier |

Un slider **NE DOIT PAS** être utilisé seul lorsque la plage est large ou
qu’une valeur exacte est importante. Tous les contrôles conservent un libellé,
une aide, une erreur textuelle et un usage clavier.

## Séquencement recommandé

1. Rendre le catalogue descriptif et marquer honnêtement les options non
   effectives.
2. Remplacer le `textarea` par un formulaire généré par catégorie, sans changer
   encore le format de publication atomique.
3. Introduire un fournisseur de policy versionnée dans le cœur IAM.
4. Migrer tous les parcours de définition de mot de passe vers ce fournisseur,
   puis retirer la source concurrente de démarrage.
5. Injecter l’expiration lors de la création de session et rendre
   `sessions.durationMinutes` effective.
6. Déplacer les contrôles de capacités dans les cas d’utilisation et exposer
   les capacités nécessaires au client.
7. Compléter confirmation renforcée, historique, restauration et état de
   propagation.

Chaque étape **DOIT** ajouter des tests démontrant que la valeur affichée comme
effective modifie réellement le comportement concerné.

## Critère de sortie

La refonte est terminée lorsque l’administrateur n’édite plus de JSON, qu’aucune
option modifiable n’est sans consommateur, et qu’une seule révision de policy
cohérente pilote chaque opération. Les entités et value objects conservent leurs
invariants propres sans décider de paramètres fonctionnels configurables.
