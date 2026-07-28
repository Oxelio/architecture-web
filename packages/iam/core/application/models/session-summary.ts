export interface SessionSummary {
  readonly userId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  readonly isActive: boolean;
  readonly isCurrent: boolean;
  readonly client: {
    readonly type: "browser" | "application" | "unknown";
    readonly name: string | null;
    readonly version: string | null;
    readonly deviceType: "desktop" | "phone" | "tablet" | "unknown";
    readonly operatingSystem: {
      readonly name: string;
      readonly version: string | null;
    } | null;
  };
  readonly network: {
    readonly ipAddress: string | null;
    readonly location: {
      readonly country: string;
      readonly region: string | null;
      readonly city: string | null;
      readonly approximate: true;
    } | null;
  };
}
