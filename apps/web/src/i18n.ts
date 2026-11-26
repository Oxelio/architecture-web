// @file apps/web/src/i18n.ts

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type Language = "fr" | "en";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "fr";
  }

  const storedLanguage = window.localStorage?.getItem("locale");
  if (storedLanguage === "fr" || storedLanguage === "en") {
    return storedLanguage;
  }

  const browserLanguage = navigator.language.split("-")[0];
  return browserLanguage === "en" ? "en" : "fr";
};

// Group each FR/EN translation pair under one key to preserve structural parity
// without duplicating the entire resource schema for each locale.
const localizedCopy = {
  document: {
    description: [
      "Front React moderne relié à une API Fastify pour gérer l'identité et l'authentification.",
      "Modern React frontend connected to a Fastify API for identity and authentication management.",
    ],
  },
  cancelDeletion: {
    eyebrow: ["Suppression du compte", "Account deletion"],
    title: ["Annuler la suppression", "Cancel deletion"],
    success: [
      "La demande de suppression a été annulée. Le compte retrouve son statut précédent. Les sessions révoquées restent révoquées.",
      "The deletion request has been cancelled. The account returns to its previous status. Previously revoked sessions remain revoked.",
    ],
    signIn: ["Se connecter", "Sign in"],
    password: ["Mot de passe", "Password"],
    mfaCode: ["Code MFA si activé", "MFA code, if enabled"],
    confirm: ["Confirmer l’annulation", "Confirm cancellation"],
    pending: ["Annulation en cours…", "Cancelling…"],
  },
  securityCenter: {
    mfaTitle: ["Authentification multifacteur", "Multifactor authentication"],
    mfaEnabled_one: [
      "Active · {{count}} code de secours restant",
      "Enabled · {{count}} backup code remaining",
    ],
    mfaEnabled_other: [
      "Active · {{count}} codes de secours restants",
      "Enabled · {{count}} backup codes remaining",
    ],
    mfaDisabled: [
      "Inactive · protégez chaque nouvelle connexion avec TOTP.",
      "Disabled · protect each new sign-in with TOTP.",
    ],
    currentPassword: ["Mot de passe actuel", "Current password"],
    mfaCode: ["Code TOTP ou de secours", "TOTP or backup code"],
    saveCodesTitle: [
      "Enregistrez ces codes maintenant",
      "Save these codes now",
    ],
    saveCodesConfirm: [
      "J’ai enregistré ces codes, activer le MFA",
      "I saved these codes, enable MFA",
    ],
    dataTitle: ["Données du compte", "Account data"],
    exportDescription: [
      "L’export ZIP est disponible 24 h et disparaît après son premier téléchargement.",
      "The ZIP export is available for 24 hours and is removed after its first download.",
    ],
    prepareExport: ["Préparer mon export", "Prepare my export"],
    download: ["Télécharger", "Download"],
    deleteRequest: [
      "Demander la suppression du compte",
      "Request account deletion",
    ],
    deletionTitle: ["Supprimer votre compte", "Delete your account"],
    deletionBack: ["Retour à mon profil", "Back to my profile"],
    deletionContinue: [
      "Continuer vers la confirmation",
      "Continue to confirmation",
    ],
    deletionVerifying: [
      "Vérification du délai effectif…",
      "Verifying the effective grace period…",
    ],
    deletionConfirmTitle: [
      "Confirmer la suppression",
      "Confirm account deletion",
    ],
    deletionConfirmDescription: [
      "Votre accès sera désactivé immédiatement dès l’acceptation de la demande.",
      "Your access will be disabled immediately when the request is accepted.",
    ],
    deletionMfaUnavailable: [
      "Impossible de vérifier l’état MFA actuel. La confirmation est bloquée ; réessayez.",
      "The current MFA status is unavailable. Confirmation is blocked; please retry.",
    ],
    deletionDescription: [
      "Cette demande désactivera votre accès immédiatement. Vérifiez les conséquences avant de continuer.",
      "This request will immediately disable your access. Review the consequences before continuing.",
    ],
    deletionGracePeriod_one: [
      "Suppression définitive de votre compte après {{count}} jour de délai de grâce.",
      "Your account is scheduled for permanent deletion after a {{count}}-day grace period.",
    ],
    deletionGracePeriod_other: [
      "Suppression définitive de votre compte après {{count}} jours de délai de grâce.",
      "Your account is scheduled for permanent deletion after a {{count}}-day grace period.",
    ],
    deletionCancellation: [
      "Pendant ce délai, vous pouvez annuler la demande avec le lien envoyé à votre adresse vérifiée, après une vérification renforcée.",
      "During this period, you can cancel the request using the link sent to your verified email address, after strengthened identity verification.",
    ],
    deletionImmediateTitle: [
      "Dès la confirmation",
      "Immediately after confirmation",
    ],
    deletionAfterTitle: ["À l’expiration du délai", "After the grace period"],
    deletionOtherTitle: [
      "Conservation et autres conséquences",
      "Retention and other consequences",
    ],
    deletionAccess: [
      "Vos sessions et jetons actifs seront révoqués immédiatement. Vous ne pourrez plus vous connecter ni demander de nouvel export.",
      "Your sessions and active tokens will be revoked immediately. You will no longer be able to sign in or request a new export.",
    ],
    deletionData: [
      "Les identifiants du compte, le mot de passe, les sessions, les jetons de récupération et de vérification, les secrets et codes MFA, les archives d’export et les données techniques non soumises à conservation seront supprimés.",
      "Account identifiers, the password, sessions, recovery and verification tokens, MFA secrets and codes, export archives, and technical data with no retention duty will be deleted.",
    ],
    deletionRetention: [
      "Une obligation légale peut imposer la conservation temporaire de certaines données. Les journaux d’audit conservés sont limités dans le temps et leurs références directes au compte sont supprimées ou pseudonymisées. Les sauvegardes et ressources externes ne sont pas nécessairement effacées immédiatement.",
      "Legal obligations may require temporary retention of some data. Retained audit records are time-limited, with direct account references removed or pseudonymized. Backups and external resources may not be erased immediately.",
    ],
    deletionAdministrator: [
      "Un compte administrateur perdra ses accès d’administration. Le dernier administrateur actif ne peut pas demander la suppression de son propre compte.",
      "An administrator account will lose administrative access. The last active administrator cannot request deletion of their own account.",
    ],
    deletionNotification: [
      "Une notification dont l’envoi a été autorisé avant l’effacement définitif peut encore être envoyée ou arriver après cet effacement.",
      "A notification authorized before final account erasure may still be sent or arrive afterward.",
    ],
    deletionAcknowledgement_one: [
      "Je comprends ces conséquences et confirme le délai effectif de {{count}} jour.",
      "I understand these consequences and confirm the effective grace period of {{count}} day.",
    ],
    deletionAcknowledgement_other: [
      "Je comprends ces conséquences et confirme le délai effectif de {{count}} jours.",
      "I understand these consequences and confirm the effective grace period of {{count}} days.",
    ],
    deletionLoading: [
      "Chargement de la politique de suppression effective…",
      "Loading the effective deletion policy…",
    ],
    deletionUnavailable: [
      "Impossible de connaître le délai effectif. La suppression est bloquée ; réessayez.",
      "The effective grace period is unavailable. Deletion is blocked; please retry.",
    ],
    deletionDisabled: [
      "La suppression des comptes est actuellement désactivée.",
      "Account deletion is currently disabled.",
    ],
    deletionRetry: ["Réessayer", "Retry"],
    deletionChanged: [
      "Le délai de grâce a changé. Lisez les nouvelles informations et confirmez de nouveau.",
      "The grace period changed. Review the updated disclosure and confirm again.",
    ],
    deletionLastAdministrator: [
      "Ce compte est le dernier administrateur actif. Désignez un autre administrateur actif avant de renouveler la demande de suppression.",
      "This account is the last active administrator. Make another administrator active before requesting deletion again.",
    ],
    deletionError: [
      "La demande de suppression n’a pas été acceptée. Vérifiez vos informations et réessayez.",
      "The deletion request was not accepted. Check your credentials and retry.",
    ],
    deletionCancel: ["Annuler", "Cancel"],
    deletionConfirmAction: ["Demander la suppression", "Request deletion"],
    deletionPending: [
      "Demande de suppression en cours…",
      "Submitting deletion request…",
    ],
    activityTitle: ["Activité de sécurité", "Security activity"],
    confirmEnrollment: ["Valider l’enrôlement", "Confirm enrollment"],
    enrollmentQrAlt: ["Code QR de configuration TOTP", "TOTP setup QR code"],
    disableMfa: ["Désactiver le MFA", "Disable MFA"],
    enableMfa: ["Configurer le MFA", "Set up MFA"],
    exportStatus: {
      ready: ["Prêt", "Ready"],
      pending: ["En attente", "Pending"],
      generating: ["En cours de préparation", "Preparing"],
      downloaded: ["Téléchargé", "Downloaded"],
      expired: ["Expiré", "Expired"],
      failed: ["Échec", "Failed"],
    },
    eventResult: {
      success: ["Succès", "Success"],
      failure: ["Échec", "Failure"],
      rejected: ["Refusé", "Rejected"],
      technical_failure: ["Erreur technique", "Technical failure"],
      error: ["Erreur", "Error"],
    },
  },
  securityConfig: {
    navigation: ["Navigation de la sécurité", "Security navigation"],
    tabs: {
      configuration: ["Configuration", "Configuration"],
      history: ["Historique", "History"],
      audit: ["Journal d’audit", "Audit log"],
    },
    title: ["Configuration de sécurité", "Security configuration"],
    description: [
      "Configurez les fonctionnalités par intention métier. Les changements sont prévisualisés puis publiés atomiquement.",
      "Configure features by business intent. Changes are previewed and then published atomically.",
    ],
    reset: ["Annuler les modifications", "Discard changes"],
    preview: ["Prévisualiser l’impact", "Preview impact"],
    publish: ["Publier sans redémarrage", "Publish without restart"],
    confirmCritical: [
      "Je confirme avoir examiné les conséquences de cette modification critique.",
      "I confirm that I have reviewed the consequences of this critical change.",
    ],
    previewSummary_one: [
      "{{count}} option modifiée · impact {{impact}}",
      "{{count}} option changed · {{impact}} impact",
    ],
    previewSummary_other: [
      "{{count}} options modifiées · impact {{impact}}",
      "{{count}} options changed · {{impact}} impact",
    ],
    historyTitle: ["Historique des révisions", "Revision history"],
    revision: ["Révision {{version}}", "Revision {{version}}"],
    restore: ["Restaurer", "Restore"],
    auditTitle: ["Journal de sécurité", "Security audit log"],
    sliderLabel: ["{{label}} — curseur", "{{label}} — slider"],
    recommended: ["Recommandé", "Recommended"],
    booleanValue: {
      enabled: ["Activé", "Enabled"],
      disabled: ["Désactivé", "Disabled"],
    },
    revisionOrigin: {
      administration: ["Administration", "Administration"],
      initialization: ["Initialisation", "Initialization"],
      restoration: ["Restauration", "Restoration"],
      operations: ["Opérations", "Operations"],
    },
    readOnly: [
      "Lecture seule : aucun consommateur exécutable n’applique actuellement cette option.",
      "Read-only: no executable consumer currently applies this option.",
    ],
    fieldDescription: [
      "{{label}}. Cette valeur est appliquée par le serveur après publication.",
      "{{label}}. This value is applied by the server after publication.",
    ],
    previewWarnings: {
      mfaAvailability: [
        "Désactiver la disponibilité du MFA ne supprime pas les paramètres MFA chiffrés existants.",
        "Disabling MFA availability does not erase existing encrypted MFA settings.",
      ],
      auditRetention: [
        "La prochaine maintenance peut supprimer des événements d’audit plus anciens.",
        "The next maintenance run may purge older audit events.",
      ],
    },
    impact: {
      standard: ["Standard", "Standard"],
      medium: ["Moyen", "Medium"],
      high: ["Élevé", "High"],
      critical: ["Critique", "Critical"],
    },
    revisionStatus: {
      published: ["Publiée", "Published"],
      effective: ["En vigueur", "Effective"],
      superseded: ["Remplacée", "Superseded"],
      pending: ["En attente", "Pending"],
      failed: ["Échec", "Failed"],
      applied: ["Appliquée", "Applied"],
      archived: ["Archivée", "Archived"],
    },
    eventResult: {
      success: ["Succès", "Success"],
      rejected: ["Refusé", "Rejected"],
      failure: ["Échec", "Failure"],
      technical_failure: ["Erreur technique", "Technical failure"],
    },
    categories: {
      accounts: ["Comptes", "Accounts"],
      authentication: ["Authentification", "Authentication"],
      passwords: ["Mots de passe", "Passwords"],
      sessions: ["Sessions", "Sessions"],
      recovery: ["Récupération", "Recovery"],
      audit: ["Audit", "Audit"],
    },
    fields: {
      accounts: {
        publicRegistration: ["Inscription publique", "Public sign-up"],
        allowedLoginIdentifiers: [
          "Identifiants de connexion autorisés",
          "Allowed login identifiers",
        ],
        emailVerification: [
          "Vérification de l’adresse email",
          "Email verification",
        ],
        emailChange: ["Changement d’adresse email", "Email change"],
        export: ["Export du compte", "Account export"],
        deletion: ["Suppression du compte", "Account deletion"],
        deletionGraceDays: ["Délai avant suppression", "Deletion grace period"],
      },
      authentication: {
        mfaAvailable: ["MFA disponible", "MFA available"],
        mfaRequiredRoles: ["Rôles soumis au MFA", "MFA-required roles"],
        mfaChallengeMinutes: [
          "Durée du challenge MFA",
          "MFA challenge duration",
        ],
        mfaMaxAttempts: ["Tentatives MFA maximales", "Maximum MFA attempts"],
        recentAuthenticationMinutes: [
          "Authentification considérée récente",
          "Recent authentication window",
        ],
      },
      passwords: {
        standardLevel: ["Niveau standard", "Standard level"],
        privilegedLevel: ["Niveau privilégié", "Privileged level"],
        standardMinLength: [
          "Longueur minimale standard",
          "Standard minimum length",
        ],
        privilegedMinLength: [
          "Longueur minimale privilégiée",
          "Privileged minimum length",
        ],
        maxLength: ["Longueur maximale", "Maximum length"],
        standardMinimumStrength: [
          "Robustesse minimale standard",
          "Standard minimum strength",
        ],
        privilegedMinimumStrength: [
          "Robustesse minimale privilégiée",
          "Privileged minimum strength",
        ],
        checkCommonPasswords: [
          "Refuser les mots de passe courants",
          "Reject common passwords",
        ],
        checkCompromisedPasswords: [
          "Refuser les mots de passe compromis",
          "Reject compromised passwords",
        ],
        checkUserContext: [
          "Vérifier le contexte utilisateur",
          "Check user context",
        ],
        rejectCurrentPassword: [
          "Refuser le mot de passe actuel",
          "Reject current password",
        ],
        requireUppercase: ["Exiger une majuscule", "Require uppercase"],
        requireLowercase: ["Exiger une minuscule", "Require lowercase"],
        requireNumber: ["Exiger un nombre", "Require a number"],
        requireSpecialCharacter: [
          "Exiger un caractère spécial",
          "Require a special character",
        ],
      },
      sessions: {
        userManagement: [
          "Gestion des sessions par l’utilisateur",
          "User session management",
        ],
        durationMinutes: ["Durée d’une session", "Session duration"],
      },
      recovery: {
        enabled: ["Récupération de compte", "Account recovery"],
        tokenMinutes: [
          "Validité du lien de récupération",
          "Recovery link validity",
        ],
        requestsPerHour: [
          "Demandes de récupération par heure",
          "Recovery requests per hour",
        ],
      },
      audit: {
        consultation: ["Consultation de l’audit", "Audit consultation"],
        retentionDays: ["Durée de conservation", "Retention period"],
      },
    },
    choices: {
      username: ["Pseudonyme", "Username"],
      email: ["Adresse email", "Email address"],
      user: ["Utilisateurs", "Users"],
      admin: ["Administrateurs", "Administrators"],
      standard: ["Standard", "Standard"],
      elevated: ["Renforcé", "Elevated"],
      critical: ["Critique", "Critical"],
      custom: ["Personnalisé", "Custom"],
      too_weak: ["Très faible", "Too weak"],
      weak: ["Faible", "Weak"],
      acceptable: ["Acceptable", "Acceptable"],
      strong: ["Forte", "Strong"],
      very_strong: ["Très forte", "Very strong"],
    },
    units: {
      minutes: ["minutes", "minutes"],
      days: ["jours", "days"],
      characters: ["caractères", "characters"],
      attempts: ["tentatives", "attempts"],
      requests: ["demandes", "requests"],
    },
    error: [
      "Le service n’a pas pu confirmer le résultat. Actualisez la version publiée avant de réessayer.",
      "The service could not confirm the outcome. Refresh the published version before trying again.",
    ],
    invalid: [
      "Vérifiez les paramètres de la configuration.",
      "Check the configuration settings.",
    ],
    justificationRequired: [
      "Saisissez un motif pour cette modification.",
      "Enter a reason for this change.",
    ],
    confirmationRequired: [
      "Confirmez la modification critique pour continuer.",
      "Confirm the critical change to continue.",
    ],
    versionConflict: [
      "La configuration a changé. Actualisez-la avant de réessayer.",
      "The configuration has changed. Refresh it before trying again.",
    ],
    revisionMissing: [
      "Cette version n’est plus disponible. Actualisez l’historique.",
      "This version is no longer available. Refresh the history.",
    ],
    confirmationRefused: [
      "La confirmation a été refusée. Vérifiez votre mot de passe et, si nécessaire, saisissez un nouveau code MFA ou un code de récupération inutilisé.",
      "Confirmation was refused. Check your password and, if required, enter a new MFA code or an unused recovery code.",
    ],
    confirmationAttemptsExhausted: [
      "Vous avez atteint la limite de tentatives. Patientez quelques minutes avant de confirmer à nouveau.",
      "You reached the confirmation attempt limit. Wait a few minutes before trying again.",
    ],
    sessionExpired: [
      "Votre session n’est plus valide. Reconnectez-vous pour continuer.",
      "Your session is no longer valid. Sign in again to continue.",
    ],
    administratorRequired: [
      "Vous n’avez plus l’autorisation de gérer cette configuration.",
      "You no longer have permission to manage this configuration.",
    ],
    recentAuthenticationDescription: [
      "Âge maximal de la session pour la gestion du MFA, l’export et la suppression du compte.",
      "Maximum session age for MFA management, account export, and account deletion.",
    ],
    confirmAgainstVersion: [
      "Version publiée examinée : {{version}}",
      "Reviewed published version {{version}}",
    ],
    restoreTarget: [
      "Version à restaurer : {{version}}",
      "Restore version {{version}}",
    ],
    applyRestoration: ["Appliquer la restauration", "Apply restoration"],
    refreshRevision: [
      "Actualiser la version publiée",
      "Refresh published version",
    ],
    previewAgainstLatest: [
      "Prévisualiser mes modifications sur la dernière version",
      "Preview my edits on the latest version",
    ],
    applying: ["Application en cours…", "Applying…"],
    previewPending: ["Prévisualisation en cours…", "Preparing preview…"],
    completed: {
      publication: [
        "Configuration publiée. Version {{version}}.",
        "Configuration published. Version {{version}}.",
      ],
      restoration: [
        "Configuration restaurée. Version {{version}}.",
        "Configuration restored. Version {{version}}.",
      ],
    },
    authenticationFailed: [
      "La vérification de votre identité a échoué. Vérifiez vos informations et réessayez.",
      "Could not verify your identity. Check your credentials and try again.",
    ],
    recentAuthenticationRequired: [
      "Une authentification récente est requise. Reconnectez-vous avant de réessayer.",
      "Recent authentication is required. Sign in again before retrying.",
    ],
    stepUp: [
      "Modifications critiques et restauration",
      "Critical changes and restoration",
    ],
    justification: ["Motif", "Reason"],
    password: ["Mot de passe actuel", "Current password"],
    mfaCode: [
      "Code MFA ou de récupération, si activé",
      "MFA or recovery code, when enabled",
    ],
    confirm: [
      "Confirmer la modification critique",
      "Confirm the critical change",
    ],
    notRecorded: ["Non enregistré", "Not recorded"],
  },
} as const;

function selectLocalizedCopy(
  source: Record<string, unknown>,
  language: Language,
): Record<string, unknown> {
  const languageIndex = language === "fr" ? 0 : 1;

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value[languageIndex]
        : selectLocalizedCopy(value as Record<string, unknown>, language),
    ]),
  );
}

const resources = {
  fr: {
    translation: {
      ...selectLocalizedCopy(localizedCopy, "fr"),
      passwordFeedback: {
        empty: "Saisissez un mot de passe.",
        confirmation_mismatch:
          "La confirmation ne correspond pas au mot de passe.",
        too_short: "Le mot de passe est trop court.",
        too_long: "Le mot de passe est trop long.",
        too_common: "Ce mot de passe est trop courant.",
        compromised:
          "Ce mot de passe figure dans des données compromises. Choisissez-en un autre.",
        contextual:
          "Le mot de passe contient des informations liées au compte.",
        too_weak:
          "Choisissez un mot de passe plus difficile à deviner, par exemple une phrase de passe plus longue et unique.",
        currentInvalid: "Le mot de passe actuel est incorrect.",
        reused: "Le nouveau mot de passe doit être différent du précédent.",
        uppercase_required: "Une majuscule est requise.",
        lowercase_required: "Une minuscule est requise.",
        number_required: "Un chiffre est requis.",
        special_character_required: "Un caractère spécial est requis.",
        invalid: "Le mot de passe ne respecte pas la politique applicable.",
        recovery_invalid: "Ce lien de récupération est invalide ou a expiré.",
        recovery_invalid_request:
          "Saisissez le nouveau mot de passe et sa confirmation.",
        unavailable: "L’opération est momentanément indisponible. Réessayez.",
        privileged:
          "Des exigences supplémentaires peuvent s’appliquer aux comptes privilégiés.",
      },
      common: {
        loading: "Chargement...",
        email: "Email",
        password: "Mot de passe",
        passwordConfirmation: "Confirmation du mot de passe",
        unknownError: "Erreur inconnue",
      },
      errorFeedback: {
        unexpected: "L’opération a échoué. Réessayez plus tard.",
        invalidField: "Vérifiez la valeur de ce champ.",
        emailChangeDisabled:
          "La modification de l’adresse e-mail est actuellement désactivée.",
        emailAlreadyUsed: "Cette adresse e-mail est déjà utilisée.",
        verificationRate:
          "Attendez avant de demander un nouvel e-mail de vérification.",
        sessionManagementDisabled:
          "La gestion des sessions est actuellement désactivée.",
        sessionNotFound:
          "Cette session n’est plus disponible. Actualisez la liste.",
        adminUserNotFound:
          "Ce compte n’est plus disponible. Actualisez la liste.",
        adminSelfOperation:
          "Vous ne pouvez pas effectuer cette action sur votre propre compte.",
        lastAdministrator:
          "Cette action doit laisser au moins un accès administrateur utilisable.",
        cancelDeletionFailed:
          "Ce lien n’est plus utilisable ou la vérification a échoué.",
      },
      language: {
        label: "Langue",
        french: "FR",
        english: "EN",
      },
      nav: {
        home: "Accueil",
        profile: "Profil",
        notifications: "Notifications",
        admin: "Administration",
        signIn: "Connexion",
        signUp: "Inscription",
      },
      notifications: {
        eyebrow: "Centre de notifications",
        title: "Vos alertes",
        description:
          "Retrouvez les changements importants concernant votre compte et votre sécurité.",
        markAllRead: "Tout marquer comme lu",
        markRead: "Marquer comme lu : {{title}}",
        empty: "Vous n’avez aucune notification.",
        error: "Impossible de charger les notifications.",
        preferences: "Préférences de diffusion",
        preferencesHint:
          "Les alertes de sécurité critiques restent obligatoires.",
        channel: {
          email: "E-mail",
          slack: "Slack",
          sms: "SMS",
        },
      },
      home: {
        eyebrow: "IAM platform",
        heroTitle: "Un portail élégant et fiable pour votre authentification.",
        heroSubtitle:
          "Connecte ton front React à l’API Fastify, avec un design clair, réactif et animé.",
        primaryAction: "Voir mon profil",
        primaryActionGuest: "Créer un compte",
        secondaryAction: "Mon espace",
        secondaryActionGuest: "Connexion",
        featureTitle: "Sécurité robuste",
        featureDescription:
          "Session cookie, gestion d’erreur claire et validation côté serveur.",
        featureTitleTwo: "Expérience fluide",
        featureDescriptionTwo:
          "Animations subtiles, chargement optimisé et navigation instantanée.",
        featureTitleThree: "Code maintenable",
        featureDescriptionThree:
          "TypeScript, React Query et composants petits et réutilisables.",
        sectionEyebrow: "Bienvenue",
        sectionTitle: "Une interface moderne pour ton identité",
        sectionDescription:
          "Explore comment un front React bien structuré peut exploiter ton API d’authentification, tout en gardant une UI élégante et accessible.",
        statusLabel: "Statut",
        statusChecking: "Vérification en cours",
        statusConnected: "Connecté en tant que {{identifier}}",
        statusDisconnected: "Non connecté",
        apiLabel: "Clé API",
        apiHelp:
          "Utilise l’API GET /iam/me pour récupérer le profil utilisateur.",
      },
      auth: {
        identifier: "Identifiant de connexion",
        identifierType: "Type d’identifiant",
        username: "Pseudonyme",
        identifierRequired: "Saisissez votre identifiant de connexion.",
        identifierNotAllowed: "Choisissez un type d’identifiant autorisé.",
        invalidEmail: "Email invalide",
        invalidUsername:
          "Le pseudonyme doit commencer par une lettre ou un chiffre et contenir de 3 à 32 caractères. Vous pouvez utiliser des lettres, des chiffres, des points, des tirets et des underscores.",
        passwordMin:
          "Le mot de passe doit contenir au moins {{count}} caractères",
        passwordMax:
          "Le mot de passe doit contenir au maximum {{count}} caractères",
        passwordConfirmationMismatch:
          "La confirmation ne correspond pas au mot de passe",
        passwordPolicyHint:
          "{{min}} à {{max}} caractères Unicode, espaces et phrases de passe acceptés",
        signInTitle: "Accède à ton espace",
        signInDescription:
          "Utilise ton email et ton mot de passe pour te connecter au système.",
        signInSubmit: "Se connecter",
        signInPending: "Connexion...",
        signInError:
          "Impossible de vous connecter. Vérifiez votre identifiant et votre mot de passe, puis réessayez.",
        secondFactorCode: "Code de l’application ou code de secours",
        verifySecondFactor: "Vérifier le second facteur",
        mfaError:
          "Impossible de vérifier le second facteur. Vérifiez votre code ou reconnectez-vous.",
        signInLinkText: "Pas encore de compte ?",
        signInLinkAction: "Crée-en un",
        forgotPassword: "Mot de passe oublié",
        signUpTitle: "Crée ton compte",
        signUpDescription:
          "Enregistre-toi pour accéder à ton espace sécurisé et gérer ton profil.",
        signUpSubmit: "Créer un compte",
        signUpPending: "Création...",
        signUpLinkText: "Déjà inscrit ?",
        signUpLinkAction: "Connecte-toi",
        signUpSuccess:
          "Inscription réussie. Vérifie ton email pour activer ton compte.",
        accountAlreadyExists: "Cet identifiant de connexion est déjà utilisé.",
        signUpUnavailable:
          "L’inscription publique est actuellement désactivée.",
        signUpError:
          "Impossible de créer ton compte pour le moment. Réessaie plus tard.",
      },
      recovery: {
        eyebrow: "Récupération sécurisée",
        requestTitle: "Retrouver votre compte",
        resetTitle: "Choisir un nouveau mot de passe",
        requestDescription:
          "Si le compte est éligible, nous enverrons des instructions. La réponse reste identique pour toutes les adresses.",
        resetDescription:
          "Le lien est temporaire et ne pourra être utilisé qu’une fois.",
        requestSuccess:
          "Si le compte est éligible, les instructions ont été envoyées.",
        resetSuccess:
          "Mot de passe remplacé. Toutes les sessions ont été révoquées.",
        backToSignIn: "Retour à la connexion",
        newPassword: "Nouveau mot de passe",
        confirmation: "Confirmation",
        email: "Adresse e-mail",
        pending: "Traitement…",
        resetSubmit: "Réinitialiser",
        requestSubmit: "Envoyer les instructions",
      },
      profile: {
        title: "Mon compte",
        welcome: "Bienvenue, {{email}}",
        description:
          "Gérez votre identité, renforcez la sécurité de votre compte et contrôlez vos connexions actives.",
        identifier: "Identifiant du compte",
        role: {
          user: "Membre",
          admin: "Administrateur",
        },
        accountProgress: "Configuration du compte",
        accountReady: "Votre compte est configuré et prêt à être utilisé.",
        accountIncomplete:
          "Vérifiez votre adresse email pour finaliser votre compte.",
        sections: "Sections du profil",
        identitySection: "Identité & coordonnées",
        identityDescription:
          "Consultez les informations liées à votre compte et modifiez votre adresse de connexion.",
        securitySection: "Mot de passe & sécurité",
        sessionsSection: "Appareils & sessions",
        memberSince: "Membre depuis",
        lastUpdate: "Dernière mise à jour",
        copyIdentifier: "Copier l'identifiant",
        identifierCopied: "Identifiant copié dans le presse-papiers.",
        copyError: "Impossible de copier l'identifiant.",
        email: "Email",
        signOut: "Se déconnecter",
        signOutPending: "Déconnexion...",
        updateEmailTitle: "Mettre à jour l'email",
        updateEmailDescription: "Modifiez votre adresse e-mail de connexion.",
        newEmail: "Nouvelle adresse email",
        emailRequired: "Saisissez votre nouvelle adresse e-mail.",
        updateEmailSubmit: "Mettre à jour l'email",
        updateEmailPending: "Enregistrement...",
        updatePasswordTitle: "Modifier le mot de passe",
        updatePasswordDescription:
          "Utilisez un mot de passe unique pour protéger durablement votre compte.",
        newPassword: "Nouveau mot de passe",
        currentPassword: "Mot de passe actuel",
        passwordPlaceholder: "Phrase de passe longue et unique",
        updatePasswordSubmit: "Changer le mot de passe",
        updatePasswordPending: "Mise à jour...",
        passwordHint:
          "Utilisez une phrase de passe longue, unique et facile à saisir.",
        passwordLengthRule: "{{count}} caractères minimum",
        passwordStrengthRule: "Longueur et imprévisibilité recommandées",
        successEmail: "Adresse e-mail mise à jour avec succès.",
        successPassword: "Mot de passe modifié avec succès.",
        signOutError: "Impossible de se déconnecter. Réessaie.",
        emailUpdateError: "Impossible de mettre à jour l'adresse e-mail.",
        passwordUpdateError: "Impossible de modifier le mot de passe.",
        emailVerification: "Vérification de l'adresse e-mail",
        emailVerified: "Adresse vérifiée",
        emailNotVerified: "Adresse non vérifiée",
        verificationCalloutTitle: "Votre compte nécessite une dernière étape",
        emailVerificationHint:
          "Confirmez votre adresse email pour sécuriser votre compte et garantir la réception des notifications.",
        resendVerification: "Renvoyer l'e-mail de vérification",
        resendVerificationPending: "Envoi en cours...",
        successVerificationEmail: "L'e-mail de vérification a été envoyé.",
        verificationEmailError: "Impossible d'envoyer l'e-mail de vérification",
        sessionsDescription:
          "Consultez les connexions à votre compte et révoquez celles que vous ne reconnaissez pas.",
        refreshSessions: "Actualiser",
        sessionsLoading: "Chargement des sessions...",
        sessionsError: "Impossible de charger ou de gérer vos sessions.",
        activeSession: "Session connectée",
        active: "Active",
        sessionExpires: "Expiration prévue le {{date}}",
        revokeSession: "Révoquer",
        revokingSession: "Révocation...",
        sessionRevoked: "La session a été révoquée.",
        noSessions: "Aucune session active n'a été trouvée.",
        confirmRevokeSession:
          "Révoquer cette session ? L'appareil concerné sera déconnecté.",
        confirmRevokeCurrentSession:
          "Révoquer la session actuelle ? Vous serez immédiatement déconnecté.",
        dismissFeedback: "Fermer la notification",
      },
      sessions: {
        unknownClient: "Client inconnu",
        unknownSystem: "système inconnu",
        onSystem: "sur {{system}}",
        current: "Session actuelle",
        locationUnavailable: "Localisation approximative indisponible",
        unknownIp: "adresse IP inconnue",
        lastActivity: "Dernière activité : {{date}}",
        createdAt: "Créée le {{date}}",
        expiresAt: "Expiration prévue le {{date}}",
        device: {
          desktop: "Ordinateur",
          phone: "Téléphone",
          tablet: "Tablette",
          unknown: "Appareil inconnu",
        },
      },
      verify: {
        eyebrow: "Activation du compte",
        title: "Vérification de ton adresse email",
        loading: "Vérification en cours...",
        invalidLink: "Le lien de vérification est invalide.",
        success: "Ton adresse email a été vérifiée avec succès.",
        error:
          "La vérification a échoué. Vérifie le lien ou réessaie plus tard.",
        waiting: "Patiente pendant la validation...",
        awaiting:
          "Confirmez votre adresse e-mail pour terminer la vérification.",
        confirm: "Confirmer mon adresse e-mail",
        signIn: "Se connecter",
      },
      admin: {
        eyebrow: "Gestion administrative",
        title: "Centre de gestion des utilisateurs",
        description:
          "Pilote les accès, les rôles et les sessions de tous les comptes depuis une vue unique.",
        refresh: "Actualiser",
        totalUsers: "Utilisateurs",
        activeUsers: "Actifs",
        suspendedUsers: "Suspendus",
        adminUsers: "Administrateurs",
        search: "Rechercher",
        searchPlaceholder: "Rechercher par email ou identifiant…",
        filters: "Filtres utilisateurs",
        filter: {
          all: "Tous",
          active: "Actifs",
          suspended: "Suspendus",
          admin: "Administrateurs",
          allRoles: "Tous les rôles",
          allStatuses: "Tous les statuts",
          allVerification: "Toute vérification",
        },
        refreshing: "Actualisation des résultats…",
        user: "Utilisateur",
        role: "Rôle",
        status: "Statut",
        createdAt: "Créé le",
        roleValue: {
          user: "Utilisateur",
          admin: "Administrateur",
        },
        statusValue: {
          active: "Actif",
          suspended: "Suspendu",
          pending_deletion: "Suppression programmée",
        },
        you: "vous",
        empty: "Aucun utilisateur ne correspond à cette recherche.",
        loadError: "Impossible de charger les utilisateurs.",
        overviewError: "Impossible de charger les indicateurs globaux.",
        userDetails: "Détail du compte",
        close: "Fermer",
        accountManagement: "Gestion du compte",
        emailVerification: "Adresse email",
        verified: "Vérifiée",
        notVerified: "Non vérifiée",
        lastUpdate: "Dernière mise à jour",
        suspend: "Suspendre",
        activate: "Réactiver",
        selfProtection:
          "Votre propre rôle et votre statut sont protégés pour éviter de perdre l’accès administrateur.",
        sessions: "Sessions actives",
        sessionsDescription:
          "Révoquez précisément une connexion ou déconnectez tous les appareils.",
        revokeOne: "Révoquer cette session",
        revokeAll: "Tout révoquer",
        noSessions: "Aucune session active.",
        expiresAt: "Expire le {{date}}",
        sessionsError: "Impossible de gérer les sessions.",
        confirmRevokeOne:
          "Révoquer cette session ? L’appareil concerné sera déconnecté.",
        confirmRevokeAll:
          "Révoquer toutes les sessions de cet utilisateur ? Tous ses appareils seront déconnectés.",
        roleSuccess: "Le rôle a été mis à jour.",
        suspendSuccess: "L’utilisateur a été suspendu.",
        activateSuccess: "L’utilisateur a été réactivé.",
        error: "L’opération a échoué",
        pagination: {
          summary: "Résultats {{from}} à {{to}} sur {{total}}",
          previous: "Précédente",
          next: "Suivante",
          page: "Page {{page}} sur {{totalPages}}",
        },
      },
    },
  },
  en: {
    translation: {
      ...selectLocalizedCopy(localizedCopy, "en"),
      passwordFeedback: {
        empty: "Enter a password.",
        confirmation_mismatch: "Password confirmation does not match.",
        too_short: "The password is too short.",
        too_long: "The password is too long.",
        too_common: "This password is too common.",
        compromised:
          "This password appears in compromised data. Choose another one.",
        contextual: "The password contains account-specific information.",
        too_weak:
          "Choose a password that is harder to guess, such as a longer, unique passphrase.",
        currentInvalid: "The current password is incorrect.",
        reused: "The new password must differ from the previous one.",
        uppercase_required: "An uppercase character is required.",
        lowercase_required: "A lowercase character is required.",
        number_required: "A number is required.",
        special_character_required: "A special character is required.",
        invalid: "The password does not meet the applicable policy.",
        recovery_invalid: "This recovery link is invalid or has expired.",
        recovery_invalid_request: "Enter and confirm your new password.",
        unavailable:
          "The operation is temporarily unavailable. Please try again.",
        privileged: "Additional requirements may apply to privileged accounts.",
      },
      common: {
        loading: "Loading...",
        email: "Email",
        password: "Password",
        passwordConfirmation: "Password confirmation",
        unknownError: "Unknown error",
      },
      errorFeedback: {
        unexpected: "The operation failed. Please try again later.",
        invalidField: "Check the value in this field.",
        emailChangeDisabled:
          "Changing your email address is currently disabled.",
        emailAlreadyUsed: "This email address is already in use.",
        verificationRate: "Wait before requesting another verification email.",
        sessionManagementDisabled: "Session management is currently disabled.",
        sessionNotFound:
          "This session is no longer available. Refresh the list.",
        adminUserNotFound:
          "This account is no longer available. Refresh the list.",
        adminSelfOperation:
          "You cannot perform this action on your own account.",
        lastAdministrator:
          "This action must leave at least one usable administrator access path.",
        cancelDeletionFailed:
          "This link is no longer usable or verification failed.",
      },
      language: {
        label: "Language",
        french: "FR",
        english: "EN",
      },
      nav: {
        home: "Home",
        profile: "Profile",
        notifications: "Notifications",
        admin: "Administration",
        signIn: "Sign in",
        signUp: "Sign up",
      },
      notifications: {
        eyebrow: "Notification center",
        title: "Your alerts",
        description:
          "Review important changes concerning your account and security.",
        markAllRead: "Mark all as read",
        markRead: "Mark as read: {{title}}",
        empty: "You have no notifications.",
        error: "Unable to load notifications.",
        preferences: "Delivery preferences",
        preferencesHint: "Critical security alerts remain mandatory.",
        channel: {
          email: "Email",
          slack: "Slack",
          sms: "SMS",
        },
      },
      home: {
        eyebrow: "IAM platform",
        heroTitle: "An elegant and reliable portal for your authentication.",
        heroSubtitle:
          "Connect your React front end to the Fastify API with a clear, responsive, and animated design.",
        primaryAction: "View my profile",
        primaryActionGuest: "Create an account",
        secondaryAction: "My space",
        secondaryActionGuest: "Sign in",
        featureTitle: "Robust security",
        featureDescription:
          "Cookie sessions, clear error handling, and server-side validation.",
        featureTitleTwo: "Smooth experience",
        featureDescriptionTwo:
          "Subtle animations, optimized loading, and instant navigation.",
        featureTitleThree: "Maintainable code",
        featureDescriptionThree:
          "TypeScript, React Query, and small reusable components.",
        sectionEyebrow: "Welcome",
        sectionTitle: "A modern interface for your identity",
        sectionDescription:
          "Explore how a well-structured React front end can leverage your authentication API while keeping the UI elegant and accessible.",
        statusLabel: "Status",
        statusChecking: "Checking session",
        statusConnected: "Connected as {{identifier}}",
        statusDisconnected: "Not connected",
        apiLabel: "API key",
        apiHelp: "Use the GET /iam/me API to retrieve the user profile.",
      },
      auth: {
        identifier: "Sign-in identifier",
        identifierType: "Identifier type",
        username: "Username",
        identifierRequired: "Enter your sign-in identifier.",
        identifierNotAllowed: "Choose an allowed sign-in identifier type.",
        invalidEmail: "Invalid email",
        invalidUsername:
          "Use 3 to 32 characters and start with a letter or number. Usernames can contain letters, numbers, periods, hyphens and underscores.",
        passwordMin: "Password must be at least {{count}} characters long",
        passwordMax: "Password must be at most {{count}} characters long",
        passwordConfirmationMismatch: "Password confirmation does not match",
        passwordPolicyHint:
          "{{min}} to {{max}} Unicode characters; spaces and passphrases are accepted",
        signInTitle: "Access your space",
        signInDescription:
          "Use your email and password to sign in to the platform.",
        signInSubmit: "Sign in",
        signInPending: "Signing in...",
        signInError:
          "Unable to sign in. Check your identifier and password, then try again.",
        secondFactorCode: "Authenticator app or backup code",
        verifySecondFactor: "Verify second factor",
        mfaError:
          "Unable to verify the second factor. Check your code or sign in again.",
        signInLinkText: "No account yet?",
        signInLinkAction: "Create one",
        forgotPassword: "Forgot password?",
        signUpTitle: "Create your account",
        signUpDescription:
          "Register to access your secure space and manage your profile.",
        signUpSubmit: "Create account",
        signUpPending: "Creating...",
        signUpLinkText: "Already registered?",
        signUpLinkAction: "Log in",
        signUpSuccess:
          "Registration successful. Check your email to activate your account.",
        accountAlreadyExists: "This sign-in identifier is already in use.",
        signUpUnavailable: "Public registration is currently disabled.",
        signUpError:
          "Unable to create your account right now. Please try again later.",
      },
      recovery: {
        eyebrow: "Secure account recovery",
        requestTitle: "Recover your account",
        resetTitle: "Choose a new password",
        requestDescription:
          "If the account is eligible, we will send instructions. The response is the same for every address.",
        resetDescription: "This link is temporary and can only be used once.",
        requestSuccess:
          "If the account is eligible, instructions have been sent.",
        resetSuccess:
          "Your password has been reset. All sessions have been revoked.",
        backToSignIn: "Back to sign in",
        newPassword: "New password",
        confirmation: "Confirmation",
        email: "Email address",
        pending: "Processing…",
        resetSubmit: "Reset password",
        requestSubmit: "Send instructions",
      },
      profile: {
        title: "My account",
        welcome: "Welcome, {{email}}",
        description:
          "Manage your identity, strengthen your account security, and control your active connections.",
        identifier: "Account identifier",
        role: {
          user: "Member",
          admin: "Administrator",
        },
        accountProgress: "Account setup",
        accountReady: "Your account is configured and ready to use.",
        accountIncomplete: "Verify your email address to finish your setup.",
        sections: "Profile sections",
        identitySection: "Identity & contact",
        identityDescription:
          "Review your account information and update your sign-in address.",
        securitySection: "Password & security",
        sessionsSection: "Devices & sessions",
        memberSince: "Member since",
        lastUpdate: "Last updated",
        copyIdentifier: "Copy identifier",
        identifierCopied: "Identifier copied to the clipboard.",
        copyError: "Unable to copy the identifier.",
        email: "Email",
        signOut: "Sign out",
        signOutPending: "Signing out...",
        updateEmailTitle: "Update email",
        updateEmailDescription: "Change your sign-in email address.",
        newEmail: "New email address",
        emailRequired: "Enter your new email address.",
        updateEmailSubmit: "Update email",
        updateEmailPending: "Saving...",
        updatePasswordTitle: "Change password",
        updatePasswordDescription:
          "Use a unique password to keep your account protected.",
        newPassword: "New password",
        currentPassword: "Current password",
        passwordPlaceholder: "A long, unique passphrase",
        updatePasswordSubmit: "Change password",
        updatePasswordPending: "Updating...",
        passwordHint: "Use a long, unique, and easy-to-enter passphrase.",
        passwordLengthRule: "At least {{count}} characters",
        passwordStrengthRule: "Length and unpredictability recommended",
        successEmail: "Email address updated successfully.",
        successPassword: "Password updated successfully.",
        signOutError: "Unable to sign out. Please try again.",
        emailUpdateError: "Unable to update the email address.",
        passwordUpdateError: "Unable to update the password.",
        emailVerification: "Email verification",
        emailVerified: "Verified",
        emailNotVerified: "Not verified",
        verificationCalloutTitle: "Your account needs one last step",
        emailVerificationHint:
          "Confirm your email to secure your account and make sure you receive important notifications.",
        resendVerification: "Resend verification email",
        resendVerificationPending: "Sending...",
        successVerificationEmail: "Verification email sent.",
        verificationEmailError: "Unable to send verification email",
        sessionsDescription:
          "Review account connections and revoke any session you do not recognize.",
        refreshSessions: "Refresh",
        sessionsLoading: "Loading sessions...",
        sessionsError: "Unable to load or manage your sessions.",
        activeSession: "Signed-in session",
        active: "Active",
        sessionExpires: "Scheduled to expire {{date}}",
        revokeSession: "Revoke",
        revokingSession: "Revoking...",
        sessionRevoked: "The session was revoked.",
        noSessions: "No active sessions were found.",
        confirmRevokeSession:
          "Revoke this session? The associated device will be signed out.",
        confirmRevokeCurrentSession:
          "Revoke your current session? You will be signed out immediately.",
        dismissFeedback: "Dismiss notification",
      },
      sessions: {
        unknownClient: "Unknown client",
        unknownSystem: "unknown system",
        onSystem: "on {{system}}",
        current: "Current session",
        locationUnavailable: "Approximate location unavailable",
        unknownIp: "unknown IP address",
        lastActivity: "Last activity: {{date}}",
        createdAt: "Created {{date}}",
        expiresAt: "Scheduled to expire {{date}}",
        device: {
          desktop: "Computer",
          phone: "Phone",
          tablet: "Tablet",
          unknown: "Unknown device",
        },
      },
      verify: {
        eyebrow: "Account activation",
        title: "Verifying your email address",
        loading: "Verification in progress...",
        invalidLink: "The verification link is invalid.",
        success: "Your email address has been verified successfully.",
        error: "Verification failed. Check the link or try again later.",
        waiting: "Please wait while validation runs...",
        awaiting: "Confirm your email address to complete verification.",
        confirm: "Confirm my email address",
        signIn: "Sign in",
      },
      admin: {
        eyebrow: "Administration",
        title: "User management center",
        description:
          "Manage every account's access, roles, and sessions from one place.",
        refresh: "Refresh",
        totalUsers: "Users",
        activeUsers: "Active",
        suspendedUsers: "Suspended",
        adminUsers: "Administrators",
        search: "Search",
        searchPlaceholder: "Search by email or identifier…",
        filters: "User filters",
        filter: {
          all: "All",
          active: "Active",
          suspended: "Suspended",
          admin: "Administrators",
          allRoles: "All roles",
          allStatuses: "All statuses",
          allVerification: "Any verification",
        },
        refreshing: "Refreshing results…",
        user: "User",
        role: "Role",
        status: "Status",
        createdAt: "Created",
        roleValue: {
          user: "User",
          admin: "Administrator",
        },
        statusValue: {
          active: "Active",
          suspended: "Suspended",
          pending_deletion: "Pending deletion",
        },
        you: "you",
        empty: "No users match this search.",
        loadError: "Unable to load users.",
        overviewError: "Unable to load global indicators.",
        userDetails: "Account details",
        close: "Close",
        accountManagement: "Account management",
        emailVerification: "Email address",
        verified: "Verified",
        notVerified: "Not verified",
        lastUpdate: "Last updated",
        suspend: "Suspend",
        activate: "Reactivate",
        selfProtection:
          "Your own role and status are protected to prevent losing administrator access.",
        sessions: "Active sessions",
        sessionsDescription:
          "Revoke one connection precisely or sign out every device.",
        revokeOne: "Revoke this session",
        revokeAll: "Revoke all",
        noSessions: "No active sessions.",
        expiresAt: "Expires {{date}}",
        sessionsError: "Unable to manage sessions.",
        confirmRevokeOne:
          "Revoke this session? The associated device will be signed out.",
        confirmRevokeAll:
          "Revoke all sessions for this user? Every device will be signed out.",
        roleSuccess: "The role was updated.",
        suspendSuccess: "The user was suspended.",
        activateSuccess: "The user was reactivated.",
        error: "The operation failed",
        pagination: {
          summary: "Results {{from}} to {{to}} of {{total}}",
          previous: "Previous",
          next: "Next",
          page: "Page {{page}} of {{totalPages}}",
        },
      },
    },
  },
};

function synchronizeDocumentLocale(language: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const locale: Language = language.startsWith("en") ? "en" : "fr";
  document.documentElement.lang = locale;
  const description = i18n.getFixedT(locale)("document.description");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", description);
}

i18n.on("languageChanged", synchronizeDocumentLocale);

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false,
  },
});

synchronizeDocumentLocale(i18n.language || getInitialLanguage());

export const changeLanguage = (language: Language) => {
  void i18n.changeLanguage(language);
  if (typeof window !== "undefined") {
    window.localStorage?.setItem("locale", language);
  }
};

export default i18n;
