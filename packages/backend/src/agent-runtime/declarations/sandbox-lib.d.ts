/**
 * Minimal TypeScript lib for the agent sandbox.
 *
 * Used with `noLib: true` so TypeScript never parses the massive
 * lib.esnext.d.ts chain. Only types reachable from the sandbox
 * globals (see executor.ts) are declared here.
 */

// ── Primitive interfaces ────────────────────────────────────────────────────

interface Boolean {
  valueOf(): boolean;
}
interface BooleanConstructor {
  new (value?: unknown): Boolean;
  <T>(value?: T): boolean;
  readonly prototype: Boolean;
}

interface Number {
  toString(radix?: number): string;
  toFixed(fractionDigits?: number): string;
  toLocaleString(locales?: string, options?: object): string;
  toPrecision(precision?: number): string;
  valueOf(): number;
}
interface NumberConstructor {
  new (value?: unknown): Number;
  (value?: unknown): number;
  readonly prototype: Number;
  readonly NaN: number;
  readonly MAX_SAFE_INTEGER: number;
  readonly MIN_SAFE_INTEGER: number;
  readonly POSITIVE_INFINITY: number;
  readonly NEGATIVE_INFINITY: number;
  isFinite(value: unknown): boolean;
  isInteger(value: unknown): boolean;
  isNaN(value: unknown): boolean;
  parseInt(string: string, radix?: number): number;
  parseFloat(string: string): number;
}

interface String {
  readonly length: number;
  charAt(pos: number): string;
  charCodeAt(index: number): number;
  concat(...strings: string[]): string;
  indexOf(searchString: string, position?: number): number;
  lastIndexOf(searchString: string, position?: number): number;
  includes(searchString: string, position?: number): boolean;
  startsWith(searchString: string, position?: number): boolean;
  endsWith(searchString: string, endPosition?: number): boolean;
  slice(start?: number, end?: number): string;
  substring(start: number, end?: number): string;
  toLowerCase(): string;
  toUpperCase(): string;
  trim(): string;
  trimStart(): string;
  trimEnd(): string;
  split(separator: string | RegExp, limit?: number): string[];
  replace(searchValue: string | RegExp, replaceValue: string): string;
  replaceAll(searchValue: string | RegExp, replaceValue: string): string;
  match(regexp: string | RegExp): RegExpMatchArray | null;
  matchAll(regexp: RegExp): IterableIterator<RegExpMatchArray>;
  search(regexp: string | RegExp): number;
  padStart(maxLength: number, fillString?: string): string;
  padEnd(maxLength: number, fillString?: string): string;
  repeat(count: number): string;
  at(index: number): string | undefined;
  valueOf(): string;
  toString(): string;
  [index: number]: string;
}
interface StringConstructor {
  new (value?: unknown): String;
  (value?: unknown): string;
  readonly prototype: String;
  fromCharCode(...codes: number[]): string;
}

// ── Symbol (minimal, needed for iterators) ──────────────────────────────────

interface Symbol {
  readonly description: string | undefined;
  toString(): string;
  valueOf(): symbol;
}
interface SymbolConstructor {
  (description?: string | number): symbol;
  readonly iterator: unique symbol;
  readonly asyncIterator: unique symbol;
}
declare var Symbol: SymbolConstructor;

// ── Function ────────────────────────────────────────────────────────────────

interface Function {
  apply(thisArg: unknown, argArray?: unknown[]): unknown;
  call(thisArg: unknown, ...argArray: unknown[]): unknown;
  bind(thisArg: unknown, ...argArray: unknown[]): Function;
  readonly length: number;
  readonly name: string;
}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}

// ── Object ──────────────────────────────────────────────────────────────────

type PropertyKey = string | number | symbol;

interface PropertyDescriptor {
  configurable?: boolean;
  enumerable?: boolean;
  value?: unknown;
  writable?: boolean;
  get?(): unknown;
  set?(v: unknown): void;
}
interface PropertyDescriptorMap {
  [key: string]: PropertyDescriptor;
}

interface Object {
  constructor: Function;
  toString(): string;
  valueOf(): Object;
  hasOwnProperty(v: PropertyKey): boolean;
}
interface ObjectConstructor {
  new (value?: unknown): Object;
  (value?: unknown): Object;
  readonly prototype: Object;
  keys(o: object): string[];
  values(o: object): any[];
  entries(o: object): [string, any][];
  assign<T extends object>(target: T, ...sources: object[]): T;
  freeze<T>(o: T): Readonly<T>;
  fromEntries(entries: Iterable<readonly [PropertyKey, unknown]>): Record<string, unknown>;
  getOwnPropertyNames(o: object): string[];
  defineProperty<T>(o: T, p: PropertyKey, attributes: PropertyDescriptor): T;
  create(o: object | null, properties?: PropertyDescriptorMap): object;
  is(value1: unknown, value2: unknown): boolean;
}

// ── Iteration protocol ──────────────────────────────────────────────────────

interface IteratorYieldResult<TYield> {
  done?: false;
  value: TYield;
}
interface IteratorReturnResult<TReturn> {
  done: true;
  value: TReturn;
}
type IteratorResult<T, TReturn = unknown> = IteratorYieldResult<T> | IteratorReturnResult<TReturn>;

interface Iterator<T, TReturn = unknown, TNext = unknown> {
  next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
  return?(value?: TReturn): IteratorResult<T, TReturn>;
  throw?(e?: unknown): IteratorResult<T, TReturn>;
}

interface Iterable<T> {
  [Symbol.iterator](): Iterator<T>;
}
interface IterableIterator<T> extends Iterator<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

interface AsyncIterator<T, TReturn = unknown, TNext = unknown> {
  next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  return?(value?: TReturn): Promise<IteratorResult<T, TReturn>>;
  throw?(e?: unknown): Promise<IteratorResult<T, TReturn>>;
}
interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}
interface AsyncIterableIterator<T> extends AsyncIterator<T> {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

// ── Array ───────────────────────────────────────────────────────────────────

interface ConcatArray<T> {
  readonly length: number;
  readonly [n: number]: T;
  join(separator?: string): string;
  slice(start?: number, end?: number): T[];
}

interface ReadonlyArray<T> {
  readonly length: number;
  toString(): string;
  join(separator?: string): string;
  concat(...items: (T | ConcatArray<T>)[]): T[];
  slice(start?: number, end?: number): T[];
  indexOf(searchElement: T, fromIndex?: number): number;
  lastIndexOf(searchElement: T, fromIndex?: number): number;
  includes(searchElement: T, fromIndex?: number): boolean;
  find(predicate: (value: T, index: number, obj: readonly T[]) => unknown): T | undefined;
  findIndex(predicate: (value: T, index: number, obj: readonly T[]) => unknown): number;
  filter<S extends T>(predicate: (value: T, index: number, array: readonly T[]) => value is S): S[];
  filter(predicate: (value: T, index: number, array: readonly T[]) => unknown): T[];
  map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U): U[];
  forEach(callbackfn: (value: T, index: number, array: readonly T[]) => void): void;
  every(predicate: (value: T, index: number, array: readonly T[]) => unknown): boolean;
  some(predicate: (value: T, index: number, array: readonly T[]) => unknown): boolean;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: readonly T[]) => T): T;
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: readonly T[]) => U, initialValue: U): U;
  flat<D extends number = 1>(depth?: D): T[];
  flatMap<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U | ReadonlyArray<U>): U[];
  at(index: number): T | undefined;
  keys(): IterableIterator<number>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[number, T]>;
  [Symbol.iterator](): IterableIterator<T>;
  readonly [n: number]: T;
}

interface Array<T> {
  length: number;
  toString(): string;
  push(...items: T[]): number;
  pop(): T | undefined;
  shift(): T | undefined;
  unshift(...items: T[]): number;
  concat(...items: (T | ConcatArray<T>)[]): T[];
  join(separator?: string): string;
  reverse(): T[];
  sort(compareFn?: (a: T, b: T) => number): this;
  slice(start?: number, end?: number): T[];
  splice(start: number, deleteCount?: number, ...items: T[]): T[];
  indexOf(searchElement: T, fromIndex?: number): number;
  lastIndexOf(searchElement: T, fromIndex?: number): number;
  includes(searchElement: T, fromIndex?: number): boolean;
  find(predicate: (value: T, index: number, obj: T[]) => unknown): T | undefined;
  findIndex(predicate: (value: T, index: number, obj: T[]) => unknown): number;
  filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S): S[];
  filter(predicate: (value: T, index: number, array: T[]) => unknown): T[];
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];
  forEach(callbackfn: (value: T, index: number, array: T[]) => void): void;
  every(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
  some(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  flat<D extends number = 1>(depth?: D): T[];
  flatMap<U>(callbackfn: (value: T, index: number, array: T[]) => U | ReadonlyArray<U>): U[];
  fill(value: T, start?: number, end?: number): this;
  at(index: number): T | undefined;
  keys(): IterableIterator<number>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[number, T]>;
  [Symbol.iterator](): IterableIterator<T>;
  [n: number]: T;
}
interface ArrayConstructor {
  new<T>(...items: T[]): T[];
  <T>(...items: T[]): T[];
  isArray(arg: unknown): arg is unknown[];
  from<T>(arrayLike: ArrayLike<T> | Iterable<T>): T[];
  from<T, U>(arrayLike: ArrayLike<T> | Iterable<T>, mapfn: (v: T, k: number) => U): U[];
  of<T>(...items: T[]): T[];
  readonly prototype: unknown[];
}

interface ArrayLike<T> {
  readonly length: number;
  readonly [n: number]: T;
}

// ── Template literals ───────────────────────────────────────────────────────

interface TemplateStringsArray extends ReadonlyArray<string> {
  readonly raw: readonly string[];
}

// ── Promise ─────────────────────────────────────────────────────────────────

interface PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

interface Promise<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult>;
  finally(onfinally?: (() => void) | null): Promise<T>;
}

interface PromiseConstructor {
  new<T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;
  readonly prototype: Promise<unknown>;
  resolve(): Promise<void>;
  resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  reject<T = never>(reason?: unknown): Promise<T>;
  all<T extends readonly unknown[]>(values: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
  race<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;
  allSettled<T extends readonly unknown[]>(values: T): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;
}

type Awaited<T> = T extends null | undefined ? T :
  T extends object & { then(onfulfilled: infer F, ...args: infer _): unknown } ?
    F extends ((value: infer V, ...args: infer _) => unknown) ? Awaited<V> : never :
    T;

interface PromiseFulfilledResult<T> {
  status: "fulfilled";
  value: T;
}
interface PromiseRejectedResult {
  status: "rejected";
  reason: unknown;
}
type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;

// ── Error ───────────────────────────────────────────────────────────────────

interface Error {
  name: string;
  message: string;
  stack?: string;
}
interface ErrorConstructor {
  new (message?: string): Error;
  (message?: string): Error;
  readonly prototype: Error;
}
declare var Error: ErrorConstructor;

interface TypeError extends Error {}
interface TypeErrorConstructor extends ErrorConstructor {
  new (message?: string): TypeError;
  (message?: string): TypeError;
}
declare var TypeError: TypeErrorConstructor;

interface RangeError extends Error {}
interface RangeErrorConstructor extends ErrorConstructor {
  new (message?: string): RangeError;
  (message?: string): RangeError;
}
declare var RangeError: RangeErrorConstructor;

interface URIError extends Error {}
interface URIErrorConstructor extends ErrorConstructor {
  new (message?: string): URIError;
  (message?: string): URIError;
}
declare var URIError: URIErrorConstructor;

// ── RegExp ──────────────────────────────────────────────────────────────────

interface RegExpMatchArray extends Array<string> {
  index?: number;
  input?: string;
  groups?: Record<string, string>;
}

interface RegExpExecArray extends Array<string> {
  index: number;
  input: string;
  groups?: Record<string, string>;
}

interface RegExp {
  exec(string: string): RegExpExecArray | null;
  test(string: string): boolean;
  readonly source: string;
  readonly flags: string;
  readonly global: boolean;
  readonly ignoreCase: boolean;
  readonly multiline: boolean;
  lastIndex: number;
}
interface RegExpConstructor {
  new (pattern: string | RegExp, flags?: string): RegExp;
  (pattern: string | RegExp, flags?: string): RegExp;
  readonly prototype: RegExp;
}

// ── Map ─────────────────────────────────────────────────────────────────────

interface Map<K, V> {
  readonly size: number;
  get(key: K): V | undefined;
  set(key: K, value: V): this;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
  [Symbol.iterator](): IterableIterator<[K, V]>;
}
interface MapConstructor {
  new (): Map<unknown, unknown>;
  new<K, V>(entries?: readonly (readonly [K, V])[] | null): Map<K, V>;
  readonly prototype: Map<unknown, unknown>;
}

// ── Set ─────────────────────────────────────────────────────────────────────

interface Set<T> {
  readonly size: number;
  add(value: T): this;
  has(value: T): boolean;
  delete(value: T): boolean;
  clear(): void;
  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void): void;
  keys(): IterableIterator<T>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[T, T]>;
  [Symbol.iterator](): IterableIterator<T>;
}
interface SetConstructor {
  new (): Set<unknown>;
  new<T>(values?: readonly T[] | null): Set<T>;
  readonly prototype: Set<unknown>;
}

// ── Date ────────────────────────────────────────────────────────────────────

interface Date {
  toString(): string;
  toISOString(): string;
  toJSON(): string;
  toLocaleDateString(locales?: string, options?: object): string;
  toLocaleTimeString(locales?: string, options?: object): string;
  toLocaleString(locales?: string, options?: object): string;
  getTime(): number;
  getFullYear(): number;
  getMonth(): number;
  getDate(): number;
  getDay(): number;
  getHours(): number;
  getMinutes(): number;
  getSeconds(): number;
  getMilliseconds(): number;
  setFullYear(year: number, month?: number, date?: number): number;
  setMonth(month: number, date?: number): number;
  setDate(date: number): number;
  setHours(hours: number, min?: number, sec?: number, ms?: number): number;
  setMinutes(min: number, sec?: number, ms?: number): number;
  setSeconds(sec: number, ms?: number): number;
  setMilliseconds(ms: number): number;
  valueOf(): number;
}
interface DateConstructor {
  new (): Date;
  new (date: Date): Date;
  new (value: number | string): Date;
  new (year: number, monthIndex: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
  (): string;
  readonly prototype: Date;
  now(): number;
  parse(s: string): number;
  UTC(year: number, monthIndex?: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number;
}

// ── Math ────────────────────────────────────────────────────────────────────

interface Math {
  readonly PI: number;
  readonly E: number;
  abs(x: number): number;
  ceil(x: number): number;
  floor(x: number): number;
  round(x: number): number;
  trunc(x: number): number;
  max(...values: number[]): number;
  min(...values: number[]): number;
  pow(x: number, y: number): number;
  sqrt(x: number): number;
  random(): number;
  log(x: number): number;
  log2(x: number): number;
  log10(x: number): number;
  sign(x: number): number;
}

// ── JSON ────────────────────────────────────────────────────────────────────

interface JSON {
  parse(text: string, reviver?: (key: string, value: unknown) => unknown): unknown;
  stringify(value: unknown, replacer?: ((key: string, value: unknown) => unknown) | (string | number)[] | null, space?: string | number): string;
}

// ── Global constructor variables ─────────────────────────────────────────────
// TypeScript requires these in the lib file for internal features:
// - async/await needs Promise
// - string/number/boolean primitive methods need their interfaces bound
// These are also declared in runtime.d.ts (as `declare const`) for the LLM's
// benefit; TypeScript merges them without conflict.

declare var Boolean: BooleanConstructor;
declare var Number: NumberConstructor;
declare var String: StringConstructor;
declare var Object: ObjectConstructor;
declare var Array: ArrayConstructor;
declare var RegExp: RegExpConstructor;
declare var Map: MapConstructor;
declare var Set: SetConstructor;
declare var Promise: PromiseConstructor;
declare var Date: DateConstructor;
declare var Math: Math;
declare var JSON: JSON;
declare var Error: ErrorConstructor;
declare var Symbol: SymbolConstructor;

declare function parseInt(string: string, radix?: number): number;
declare function parseFloat(string: string): number;
declare function isNaN(number: unknown): boolean;
declare function isFinite(number: unknown): boolean;
declare function encodeURIComponent(component: string): string;
declare function decodeURIComponent(component: string): string;
declare function setTimeout(callback: () => void, ms?: number): number;

// ── Utility types ───────────────────────────────────────────────────────────

type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type Record<K extends keyof never, T> = { [P in K]: T };
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type NonNullable<T> = T & {};
type ReturnType<T extends (...args: never[]) => unknown> = T extends (...args: never[]) => infer R ? R : never;
type Parameters<T extends (...args: never[]) => unknown> = T extends (...args: infer P) => unknown ? P : never;

// ── IArguments (TypeScript internal) ────────────────────────────────────────

interface IArguments {
  [index: number]: unknown;
  length: number;
  callee: Function;
}
