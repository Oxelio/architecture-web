import type { CancelAccountDeletion } from "#accounts/cancel-account-deletion/cancel-account-deletion.contracts";
import type { ChangeEmail } from "#accounts/change-email/change-email.contracts";
import type { ChangePassword } from "#accounts/change-password/change-password.contracts";
import type { DownloadAccountExport } from "#accounts/download-account-export/download-account-export.contracts";
import type { GetCurrentAccount } from "#accounts/get-current-account/get-current-account.contracts";
import type { ListAccountExports } from "#accounts/list-account-exports/list-account-exports.contracts";
import type { MaintainIamAccounts } from "#accounts/maintain-iam-accounts/maintain-iam-accounts.contracts";
import type {
  EvaluatePassword,
  GetPasswordPolicy,
} from "#accounts/password-policy/password-policy.contracts";
import type { RequestAccountDeletion } from "#accounts/request-account-deletion/request-account-deletion.contracts";
import type { RequestAccountExport } from "#accounts/request-account-export/request-account-export.contracts";
import type { RequestPasswordRecovery } from "#accounts/request-password-recovery/request-password-recovery.contracts";
import type { ResendEmailVerification } from "#accounts/resend-email-verification/resend-email-verification.contracts";
import type { ResetRecoveredPassword } from "#accounts/reset-recovered-password/reset-recovered-password.contracts";
import type { SignUp } from "#accounts/sign-up/sign-up.contracts";
import type { VerifyEmail } from "#accounts/verify-email/verify-email.contracts";

export interface AccountsApplication {
  changeEmail: ChangeEmail;
  changePassword: ChangePassword;
  getCurrentAccount: GetCurrentAccount;
  getPasswordPolicy: GetPasswordPolicy;
  evaluatePassword: EvaluatePassword;
  resendEmailVerification: ResendEmailVerification;
  signUp: SignUp;
  verifyEmail: VerifyEmail;
  requestRecovery: RequestPasswordRecovery;
  resetPassword: ResetRecoveredPassword;
  requestExport: RequestAccountExport;
  listExports: ListAccountExports;
  downloadExport: DownloadAccountExport;
  requestDeletion: RequestAccountDeletion;
  cancelDeletion: CancelAccountDeletion;
  maintainAccounts: MaintainIamAccounts;
}
