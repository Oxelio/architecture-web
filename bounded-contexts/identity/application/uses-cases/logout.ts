import type { LogoutRequestDTO } from "#dtos/logout-request";

export class Logout {
  constructor() {}

  async execute(_payload: LogoutRequestDTO): Promise<void> {
    throw new Error("Not implemented yet");
  }
}
