export const SessionPolicy = {
  totalMinutes: 60,

  expiresAt(): Date {
    return new Date(Date.now() + this.totalMinutes * 60 * 1000);
  },
} as const;
