// @file foundation/src/domain/entity.ts

import { Identifier } from "./identifier.js";

export abstract class Entity<TProperties extends { identifier: Identifier }> {
  protected properties: TProperties;

  protected constructor(properties: TProperties) {
    this.properties = properties;
  }

  get identifier(): TProperties["identifier"] {
    return this.properties.identifier;
  }

  equals(object: Entity<TProperties>): boolean {
    return (
      this.constructor === object.constructor &&
      this.identifier.equals(object.identifier)
    );
  }
}
