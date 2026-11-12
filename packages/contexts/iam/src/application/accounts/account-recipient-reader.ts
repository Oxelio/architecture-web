export interface AccountRecipientReader {
  findRecipientContact(
    userId: string,
  ): Promise<{ id: string; email: string | null } | null>;
  listActiveAdministratorIds(): Promise<string[]>;
  isActiveAdministrator(userId: string): Promise<boolean>;
}
