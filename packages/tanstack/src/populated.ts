/**
 * A polymorphic relationship's value once Payload has populated it. An unpopulated value, which
 * the request couldn't read or the query didn't populate, is an ID.
 */
export type Populated<TReference> = TReference extends { value: infer TValue }
  ? Omit<TReference, "value"> & { value: Exclude<TValue, number | string> }
  : never;
