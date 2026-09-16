/**
 * How each language spells the names a mapping records, and which of those names coincide.
 *
 * This is the only place that knows a language's grammar. Callers ask whether a name is valid,
 * which spelling two names share, and whether a package name is a technical classification; they
 * never test a language by name.
 */

import { crateParts, technicalName } from "../packaging/declarations.ts";
import type { MappingLanguage } from "./contract.ts";

/** The two kinds of model operation a mapping binds to a method. */
export type OperationKind = "command" | "factory";

export type NameTest = (name: string) => boolean;

export interface LanguageSpelling {
  readonly isPackage: NameTest;
  readonly isModuleSegment: NameTest;
  /** Type, method and error type names. */
  readonly isIdentifier: NameTest;
  readonly isErrorCase: NameTest;
  /** The spelling two module segments share when they name the same module. */
  readonly segmentIdentity: (segment: string) => string;
  /** The technical classification a package name stands on instead of a business word, if any. */
  readonly technicalPackage: (name: string) => string | undefined;
  readonly technicalSegment: (segment: string) => string | undefined;
  /** Methods in one namespace cannot share a name; the namespace an operation's method lives in. */
  readonly methodNamespace: (kind: OperationKind) => string;
}

const RUST_PACKAGE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const RUST_MODULE_SEGMENT = /^(?:r#)?[A-Za-z_][A-Za-z0-9_]*$/;
const RUST_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RAW_IDENTIFIER_PREFIX = /^r#/;

const TYPESCRIPT_PACKAGE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const TYPESCRIPT_MODULE_SEGMENT = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;
const TYPESCRIPT_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PACKAGE_SCOPE = /^@[^/]+\//;

/**
 * The words a package name is made of, with its `-domain` suffix removed. A name that is nothing
 * but `domain` names the layer, not the business, and is refused like the other classifications.
 */
function technicalPackageWords(words: readonly string[]): string | undefined {
  return technicalName(words) ?? (words.every((word) => word === "domain") ? "domain" : undefined);
}

const RUST: LanguageSpelling = {
  isPackage: (name) => RUST_PACKAGE.test(name),
  isModuleSegment: (segment) => RUST_MODULE_SEGMENT.test(segment),
  isIdentifier: (name) => RUST_IDENTIFIER.test(name),
  isErrorCase: (name) => RUST_IDENTIFIER.test(name),
  // `r#type` and `type` name one module; the raw prefix only lets a keyword be spelled.
  segmentIdentity: (segment) => segment.replace(RAW_IDENTIFIER_PREFIX, ""),
  technicalPackage: (name) => technicalPackageWords(crateParts(name)),
  technicalSegment: (segment) => technicalName([segment]),
  // Associated functions and methods of one impl share a namespace.
  methodNamespace: () => "impl",
};

const TYPESCRIPT: LanguageSpelling = {
  isPackage: (name) => TYPESCRIPT_PACKAGE.test(name),
  isModuleSegment: (segment) => TYPESCRIPT_MODULE_SEGMENT.test(segment),
  isIdentifier: (name) => TYPESCRIPT_IDENTIFIER.test(name),
  isErrorCase: (name) => name.length > 0,
  segmentIdentity: (segment) => segment,
  // The scope names the publisher, not the package; `.` separates words like `-` and `_` do.
  technicalPackage: (name) => technicalPackageWords(crateParts(name.replace(PACKAGE_SCOPE, "").replace(/\./g, "-"))),
  technicalSegment: (segment) => technicalName([segment.replace(/-/g, "_")]),
  // A factory rule is a static member and a command an instance member, so they never collide.
  methodNamespace: (kind) => (kind === "factory" ? "static" : "instance"),
};

export const SPELLINGS: Readonly<Record<MappingLanguage, LanguageSpelling>> = { rust: RUST, typescript: TYPESCRIPT };
