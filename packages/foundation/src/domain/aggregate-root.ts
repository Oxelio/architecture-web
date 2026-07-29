import { Entity } from "./entity.js";
import type { Identifier } from "./identifier.js";

/**
 * Entry point of an aggregate consistency boundary.
 *
 * Aggregate roots remain regular entities. The distinct type makes repository
 * and transaction boundaries explicit without coupling the domain to a
 * persistence mechanism.
 */
export abstract class AggregateRoot<
  TProperties extends { identifier: Identifier },
> extends Entity<TProperties> {}
