// bounded-contexts/identity/application/features/register-user/register-user.command.ts

export interface RegisterUserCommand {
  email: string;
  password: string;
}
