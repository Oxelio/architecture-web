// @file foundation/src/domain/entity.ts

import { Identifier } from "./identifier.js";

export abstract class Entity<TProperties extends { identifier: Identifier }> {
  protected props: TProperties;

  protected constructor(props: TProperties) {
    this.props = props;
  }

  get identifier(): TProperties["identifier"] {
    return this.props.identifier;
  }

  equals(object: Entity<TProperties>): boolean {
    return (
      this.constructor === object.constructor &&
      this.identifier.equals(object.identifier)
    );
  }
}
