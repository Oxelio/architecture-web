import type { AccountSecurityMail } from "@architecture/iam/application";
import { EmailValueObject } from "@architecture/iam/domain";
import type { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
export class AccountSecurityMailAdapter implements AccountSecurityMail {
  constructor(
    private readonly sender: NodemailerEmailSenderAdapter,
    private readonly recoveryUrl: string,
    private readonly cancellationUrl: string,
  ) {}
  private async send(
    email: string,
    subject: string,
    baseUrl: string,
    token: string,
  ) {
    const to = EmailValueObject.create(email);
    if (!to.success) {
      throw new Error("Invalid persisted email address");
    }
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    await this.sender.send(
      to.value,
      subject,
      `<p><a href="${url.href}">${subject}</a></p>`,
      url.href,
    );
  }
  sendRecovery(email: string, token: string) {
    return this.send(email, "Account recovery", this.recoveryUrl, token);
  }
  sendDeletionCancellation(email: string, token: string) {
    return this.send(
      email,
      "Cancel account deletion",
      this.cancellationUrl,
      token,
    );
  }
}
