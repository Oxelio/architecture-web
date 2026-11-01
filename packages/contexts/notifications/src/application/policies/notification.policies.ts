import type {
  NotificationAction,
  NotificationChannelType,
  NotificationSeverity,
} from "#domain/index";

export interface NotificationPolicy {
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly action?: NotificationAction;
  readonly notifyAdministrators?: boolean;
  readonly userChannels: readonly NotificationChannelType[];
  readonly administratorChannels?: readonly NotificationChannelType[];
  readonly mandatory?: boolean;
}

export const notificationPolicies: Readonly<
  Record<string, NotificationPolicy>
> = {
  "iam.sessions-revoked": {
    severity: "warning",
    title: "Sessions revoked",
    message:
      "Access through one or more sessions was revoked for your account.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "iam.user-registered": {
    severity: "information",
    title: "Account created",
    message: "Your account has been created.",
    action: "view_account",
    userChannels: ["email"],
  },
  "iam.user-email-changed": {
    severity: "critical",
    title: "Email address changed",
    message: "The sign-in email address for your account was changed.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "iam.user-password-changed": {
    severity: "critical",
    title: "Password changed",
    message: "The password for your account was changed.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "iam.user-role-changed": {
    severity: "warning",
    title: "Account role changed",
    message: "The permissions associated with your account were changed.",
    action: "view_account",
    notifyAdministrators: true,
    userChannels: ["email"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "iam.user-suspended": {
    severity: "critical",
    title: "Account suspended",
    message: "Your account has been suspended by an administrator.",
    notifyAdministrators: true,
    userChannels: ["email"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "iam.user-activated": {
    severity: "information",
    title: "Account activated",
    message: "Your account has been activated.",
    action: "view_account",
    userChannels: ["email"],
  },
  "iam.user-email-verified": {
    severity: "information",
    title: "Email address verified",
    message: "Your email address has been verified.",
    action: "view_account",
    userChannels: [],
  },
  "iam.session-started": {
    severity: "warning",
    title: "New session",
    message: "A new session was opened for your account.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "security.suspicious-activity-detected": {
    severity: "critical",
    title: "Suspicious activity detected",
    message: "Suspicious activity was detected on your account.",
    action: "view_account",
    notifyAdministrators: true,
    userChannels: ["email", "sms"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "account.recovery.completed": {
    severity: "critical",
    title: "Account recovery completed",
    message: "Your account password was reset through account recovery.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "account.deletion.requested": {
    severity: "critical",
    title: "Account deletion requested",
    message: "A request to delete your account was recorded.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "account.deletion.cancelled": {
    severity: "information",
    title: "Account deletion cancelled",
    message: "The request to delete your account was cancelled.",
    action: "view_account",
    userChannels: ["email"],
  },
  "mfa.activated": {
    severity: "information",
    title: "Multifactor authentication enabled",
    message: "Multifactor authentication was enabled for your account.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.disabled": {
    severity: "critical",
    title: "Multifactor authentication disabled",
    message: "Multifactor authentication was disabled for your account.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.backup_codes.regenerated": {
    severity: "warning",
    title: "Backup codes regenerated",
    message: "New multifactor authentication backup codes were generated.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.backup_code.used": {
    severity: "warning",
    title: "Backup code used",
    message: "A multifactor authentication backup code was used.",
    action: "view_account",
    userChannels: ["email"],
    mandatory: true,
  },
};
