// @file apps/web/src/i18n.ts

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type Language = "fr" | "en";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "fr";
  }

  const storedLanguage = window.localStorage.getItem("locale");
  if (storedLanguage === "fr" || storedLanguage === "en") {
    return storedLanguage;
  }

  const browserLanguage = navigator.language.split("-")[0];
  return browserLanguage === "en" ? "en" : "fr";
};

const resources = {
  fr: {
    translation: {
      common: {
        loading: "Chargement...",
        email: "Email",
        password: "Mot de passe",
        unknownError: "Erreur inconnue",
      },
      language: {
        label: "Langue",
        french: "FR",
        english: "EN",
      },
      nav: {
        home: "Accueil",
        profile: "Profil",
        admin: "Administration",
        signIn: "Connexion",
        signUp: "Inscription",
      },
      home: {
        eyebrow: "Identity platform",
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
        statusConnected: "Connecté en tant que {{email}}",
        statusDisconnected: "Non connecté",
        apiLabel: "Clé API",
        apiHelp:
          "Utilise l’API GET /identity/me pour récupérer le profil utilisateur.",
      },
      auth: {
        invalidEmail: "Email invalide",
        passwordMin: "Le mot de passe doit contenir au moins 8 caractères",
        signInTitle: "Accède à ton espace",
        signInDescription:
          "Utilise ton email et ton mot de passe pour te connecter au système.",
        signInSubmit: "Se connecter",
        signInPending: "Connexion...",
        signInLinkText: "Pas encore de compte ?",
        signInLinkAction: "Crée-en un",
        signUpTitle: "Crée ton compte",
        signUpDescription:
          "Enregistre-toi pour accéder à ton espace sécurisé et gérer ton profil.",
        signUpSubmit: "Créer un compte",
        signUpPending: "Création...",
        signUpLinkText: "Déjà inscrit ?",
        signUpLinkAction: "Connecte-toi",
        signUpSuccess:
          "Inscription réussie. Vérifie ton email pour activer ton compte.",
      },
      profile: {
        title: "Profil utilisateur",
        welcome: "Bienvenue, {{email}}",
        description:
          "Voici ton compte. Tu peux mettre à jour ton adresse email, changer ton mot de passe ou te déconnecter.",
        identifier: "Identifiant",
        email: "Email",
        signOut: "Se déconnecter",
        signOutPending: "Déconnexion...",
        updateEmailTitle: "Mettre à jour l'email",
        updateEmailDescription: "Change ton adresse e-mail de connexion.",
        newEmail: "Nouvelle adresse email",
        updateEmailSubmit: "Mettre à jour l'email",
        updateEmailPending: "Enregistrement...",
        updatePasswordTitle: "Modifier le mot de passe",
        updatePasswordDescription: "Choisis un mot de passe plus sécurisé.",
        newPassword: "Nouveau mot de passe",
        updatePasswordSubmit: "Changer le mot de passe",
        updatePasswordPending: "Mise à jour...",
        passwordHint: "Le mot de passe doit comporter au moins 8 caractères.",
        successEmail: "Adresse e-mail mise à jour avec succès.",
        successPassword: "Mot de passe modifié avec succès.",
        signOutError: "Impossible de se déconnecter. Réessaie.",
        emailUpdateError: "Impossible de mettre à jour l'adresse e-mail.",
        passwordUpdateError: "Impossible de modifier le mot de passe.",
        emailVerification: "Vérification de l'adresse e-mail",
        emailVerified: "Adresse vérifiée",
        emailNotVerified: "Adresse non vérifiée",
        emailVerificationHint:
          "Votre adresse e-mail n'est pas encore vérifiée. Un nouveau lien peut vous être envoyé.",
        resendVerification: "Renvoyer l'e-mail de vérification",
        resendVerificationPending: "Envoi en cours...",
        successVerificationEmail: "L'e-mail de vérification a été envoyé.",
        verificationEmailError: "Impossible d'envoyer l'e-mail de vérification",
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
        },
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
        },
        you: "vous",
        empty: "Aucun utilisateur ne correspond à cette recherche.",
        loadError: "Impossible de charger les utilisateurs.",
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
      },
    },
  },
  en: {
    translation: {
      common: {
        loading: "Loading...",
        email: "Email",
        password: "Password",
        unknownError: "Unknown error",
      },
      language: {
        label: "Language",
        french: "FR",
        english: "EN",
      },
      nav: {
        home: "Home",
        profile: "Profile",
        admin: "Administration",
        signIn: "Sign in",
        signUp: "Sign up",
      },
      home: {
        eyebrow: "Identity platform",
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
        statusConnected: "Connected as {{email}}",
        statusDisconnected: "Not connected",
        apiLabel: "API key",
        apiHelp: "Use the GET /identity/me API to retrieve the user profile.",
      },
      auth: {
        invalidEmail: "Invalid email",
        passwordMin: "Password must be at least 8 characters long",
        signInTitle: "Access your space",
        signInDescription:
          "Use your email and password to sign in to the platform.",
        signInSubmit: "Sign in",
        signInPending: "Signing in...",
        signInLinkText: "No account yet?",
        signInLinkAction: "Create one",
        signUpTitle: "Create your account",
        signUpDescription:
          "Register to access your secure space and manage your profile.",
        signUpSubmit: "Create account",
        signUpPending: "Creating...",
        signUpLinkText: "Already registered?",
        signUpLinkAction: "Log in",
        signUpSuccess:
          "Registration successful. Check your email to activate your account.",
      },
      profile: {
        title: "User profile",
        welcome: "Welcome, {{email}}",
        description:
          "Here is your account. You can update your email address, change your password, or sign out.",
        identifier: "Identifier",
        email: "Email",
        signOut: "Sign out",
        signOutPending: "Signing out...",
        updateEmailTitle: "Update email",
        updateEmailDescription: "Change your sign-in email address.",
        newEmail: "New email address",
        updateEmailSubmit: "Update email",
        updateEmailPending: "Saving...",
        updatePasswordTitle: "Change password",
        updatePasswordDescription: "Choose a stronger password.",
        newPassword: "New password",
        updatePasswordSubmit: "Change password",
        updatePasswordPending: "Updating...",
        passwordHint: "Password must be at least 8 characters long.",
        successEmail: "Email address updated successfully.",
        successPassword: "Password updated successfully.",
        signOutError: "Unable to sign out. Please try again.",
        emailUpdateError: "Unable to update the email address.",
        passwordUpdateError: "Unable to update the password.",
        emailVerification: "Email verification",
        emailVerified: "Verified",
        emailNotVerified: "Not verified",
        emailVerificationHint:
          "Your email address is not verified yet. A new verification link can be sent.",
        resendVerification: "Resend verification email",
        resendVerificationPending: "Sending...",
        successVerificationEmail: "Verification email sent.",
        verificationEmailError: "Unable to send verification email",
      },
      verify: {
        eyebrow: "Account activation",
        title: "Verifying your email address",
        loading: "Verification in progress...",
        invalidLink: "The verification link is invalid.",
        success: "Your email address has been verified successfully.",
        error: "Verification failed. Check the link or try again later.",
        waiting: "Please wait while validation runs...",
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
        },
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
        },
        you: "you",
        empty: "No users match this search.",
        loadError: "Unable to load users.",
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
      },
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false,
  },
});

export const changeLanguage = (language: Language) => {
  void i18n.changeLanguage(language);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("locale", language);
  }
};

export default i18n;
