/**
 * RustSyntaxAnalyzer — Rust syntax facts via the vendored tree-sitter-rust
 * WASM and web-tree-sitter runtime (U2, BR6).
 *
 * It returns facts (text + spans) only: no type inference, name resolution or
 * macro expansion (BR6.4). tree-sitter node types never leave this module
 * (BR7.1). A missing bundled asset yields `state = unavailable`, not a throw
 * (BR6.2); callers map that to exit code 127.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { TSLanguage, TSNode, TSParser, TSTree } from "./vendor/tree-sitter.ts";

export type Visibility = "private" | "pub" | "pub-crate" | "pub-super" | "pub-in";
export type BodyShape = "returns-field-only" | "assigns-field" | "other" | "opaque";
export type Receiver = "none" | "self" | "ref-self" | "mut-self" | "other";
export type OpaqueReason = "macro-item" | "macro-expression" | "attribute-macro" | "parse-error";

export interface Span {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

export interface FieldDecl {
  name: string;
  visibility: Visibility;
  type_text: string;
  span: Span;
}

export interface ParamDecl {
  name: string;
  type_text: string;
  is_by_value_self_type?: boolean;
}

export interface StructDecl {
  file: string;
  name: string;
  kind: "struct" | "enum";
  visibility: Visibility;
  fields: FieldDecl[];
  derives: string[];
  span: Span;
}

export interface MethodDecl {
  name: string;
  visibility: Visibility;
  receiver: Receiver;
  params: ParamDecl[];
  return_type_text?: string;
  body_shape: BodyShape;
  span: Span;
}

export interface ImplBlock {
  file: string;
  target_type_text: string;
  trait_text?: string;
  methods: MethodDecl[];
  span: Span;
}

export interface FnDecl {
  file: string;
  name: string;
  visibility: Visibility;
  params: ParamDecl[];
  return_type_text?: string;
  span: Span;
}

export interface UsePath {
  file: string;
  path_text: string;
  first_segment: string;
  alias?: string;
  span: Span;
}

export interface CallSite {
  file: string;
  kind: "method-call" | "path-call";
  callee_text: string;
  receiver_text?: string;
  enclosing_fn?: string;
  span: Span;
}

export interface ConstructionSite {
  file: string;
  kind: "struct-literal" | "associated-call" | "default-call" | "update-syntax";
  type_text: string;
  callee_text?: string;
  enclosing_fn?: string;
  span: Span;
}

export interface OpaqueRegion {
  file: string;
  span: Span;
  reason: OpaqueReason;
  macro_name?: string;
}

export interface SyntaxTree {
  file: string;
  content_hash: string;
  has_parse_error: boolean;
  opaque_regions: OpaqueRegion[];
}

export interface AnalyzerRuntime {
  grammar_path: string;
  runtime_path: string;
  state: "uninitialized" | "ready" | "unavailable";
  cache: Map<string, SyntaxTree>;
  parser?: TSParser;
}

const GRAMMAR_PATH = resolve(import.meta.dir, "../../wasm/tree-sitter-rust.wasm");
const RUNTIME_DIR = resolve(import.meta.dir, "vendor");
const RUNTIME_WASM = resolve(RUNTIME_DIR, "tree-sitter.wasm");
const RUNTIME_JS = resolve(RUNTIME_DIR, "tree-sitter.js");

const BUILTIN_ATTRIBUTES = new Set(["derive", "cfg", "cfg_attr", "test", "allow", "warn", "deny", "inline", "doc"]);

const TREES = new WeakMap<SyntaxTree, TSTree>();

export async function initAnalyzer(): Promise<AnalyzerRuntime> {
  const runtime: AnalyzerRuntime = {
    grammar_path: GRAMMAR_PATH,
    runtime_path: RUNTIME_DIR,
    state: "uninitialized",
    cache: new Map(),
  };
  if (!existsSync(GRAMMAR_PATH) || !existsSync(RUNTIME_WASM) || !existsSync(RUNTIME_JS)) {
    runtime.state = "unavailable";
    return runtime;
  }
  try {
    const mod = (await import("./vendor/tree-sitter.js")) as {
      Parser: {
        init(options?: { locateFile?: (name: string) => string }): Promise<void>;
        new (): TSParser;
      };
      Language: { load(path: string): Promise<TSLanguage> };
    };
    await mod.Parser.init({ locateFile: (name) => resolve(RUNTIME_DIR, name) });
    const language = await mod.Language.load(GRAMMAR_PATH);
    const parser = new mod.Parser();
    parser.setLanguage(language);
    runtime.parser = parser;
    runtime.state = "ready";
  } catch {
    runtime.state = "unavailable";
  }
  return runtime;
}

function spanOf(node: TSNode): Span {
  return {
    start_line: node.startPosition.row + 1,
    start_col: node.startPosition.column + 1,
    end_line: node.endPosition.row + 1,
    end_col: node.endPosition.column + 1,
  };
}

function walk(node: TSNode, visit: (candidate: TSNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}

function visibilityOf(node: TSNode): Visibility {
  const modifiers = node.namedChildren.filter((child) => child.type === "visibility_modifier");
  const text = modifiers[0]?.text ?? "";
  if (text === "pub") return "pub";
  if (text.startsWith("pub(crate)")) return "pub-crate";
  if (text.startsWith("pub(super)")) return "pub-super";
  if (text.startsWith("pub(in")) return "pub-in";
  return text.length === 0 ? "private" : "pub";
}

function derivesOf(node: TSNode): string[] {
  const derives: string[] = [];
  let sibling = node.previousNamedSibling;
  while (sibling && sibling.type === "attribute_item") {
    const match = /#\[\s*derive\s*\(([^)]*)\)\s*\]/.exec(sibling.text);
    if (match) {
      for (const name of match[1].split(",")) {
        const trimmed = name.trim();
        if (trimmed.length > 0) derives.push(trimmed);
      }
    }
    sibling = sibling.previousNamedSibling;
  }
  return derives;
}

function enclosingFn(node: TSNode): string | undefined {
  let current = node.parent;
  while (current) {
    if (current.type === "function_item") return current.childForFieldName("name")?.text;
    current = current.parent;
  }
  return undefined;
}

function hasOpaqueMacro(node: TSNode): boolean {
  let found = false;
  walk(node, (candidate) => {
    if (candidate.type === "macro_invocation" || candidate.isMissing) found = true;
  });
  return found;
}

function singleExprBody(body: TSNode): TSNode | undefined {
  const block = body.type === "block" ? body : undefined;
  if (!block) return undefined;
  const statements = block.namedChildren;
  if (statements.length === 0) return undefined;
  const last = statements[statements.length - 1];
  const meaningful = statements.filter((s) => s.type !== "comment");
  if (meaningful.length !== 1) return undefined;
  if (last.type === "expression_statement") return last.namedChildren[0];
  return last;
}

function isFieldReturn(expr: TSNode | undefined): boolean {
  if (!expr) return false;
  const text = expr.text.replace(/\s+/g, "");
  return /^(\(\s*&?\s*self\.[A-Za-z0-9_]+(\s*\))?|&?self\.[A-Za-z0-9_]+(\.clone\(\)|\.as_ref\(\)|\.as_deref\(\)|\.to_owned\(\)|\.to_string\(\))?)$/.test(
    text,
  );
}

function bodyShapeOf(body: TSNode | undefined): BodyShape {
  if (!body) return "other";
  if (hasOpaqueMacro(body)) return "opaque";
  let assigns = false;
  walk(body, (candidate) => {
    if (candidate.type === "assignment_expression") {
      const left = candidate.childForFieldName("left")?.text ?? "";
      if (/^self\.[A-Za-z0-9_]/.test(left)) assigns = true;
    }
    if (candidate.type === "call_expression") {
      const receiver = candidate.childForFieldName("function");
      if (receiver?.type === "field_expression") {
        const value = receiver.childForFieldName("value")?.text ?? "";
        if (/^self\.[A-Za-z0-9_]+$/.test(value)) {
          const method = receiver.childForFieldName("field")?.text ?? "";
          if (/^(set_|add_|remove_|push_|insert_|update_|clear_|mark_|replace_)/.test(method)) assigns = true;
        }
      }
    }
  });
  if (assigns) return "assigns-field";
  if (isFieldReturn(singleExprBody(body))) return "returns-field-only";
  return "other";
}

function receiverOf(parameters: TSNode | undefined): Receiver {
  if (!parameters) return "none";
  const self = parameters.namedChildren.find((child) => child.type === "self_parameter");
  if (!self) return "none";
  const text = self.text.replace(/\s+/g, " ");
  if (text.startsWith("&mut")) return "mut-self";
  if (text.startsWith("&")) return "ref-self";
  if (text === "self" || text.startsWith("self:")) return "self";
  return "other";
}

function paramsOf(parameters: TSNode | undefined, targetType?: string): ParamDecl[] {
  if (!parameters) return [];
  const out: ParamDecl[] = [];
  for (const param of parameters.namedChildren) {
    if (param.type !== "parameter") continue;
    const name = param.childForFieldName("pattern")?.text ?? "";
    const typeText = param.childForFieldName("type")?.text ?? "";
    const isSelf = typeText === "Self" || (targetType !== undefined && typeText === targetType);
    out.push({ name, type_text: typeText, ...(isSelf ? { is_by_value_self_type: true } : {}) });
  }
  return out;
}

function structFacts(file: string, tree: TSTree): StructDecl[] {
  const out: StructDecl[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "struct_item" && node.type !== "enum_item") return;
    const body = node.childForFieldName("body");
    const fields: FieldDecl[] = [];
    if (body) {
      for (const child of body.namedChildren) {
        if (child.type !== "field_declaration") continue;
        fields.push({
          name: child.childForFieldName("name")?.text ?? "",
          visibility: visibilityOf(child),
          type_text: child.childForFieldName("type")?.text ?? "",
          span: spanOf(child),
        });
      }
    }
    out.push({
      file,
      name: node.childForFieldName("name")?.text ?? "",
      kind: node.type === "struct_item" ? "struct" : "enum",
      visibility: visibilityOf(node),
      fields,
      derives: derivesOf(node),
      span: spanOf(node),
    });
  });
  return out;
}

function implFacts(file: string, tree: TSTree): ImplBlock[] {
  const out: ImplBlock[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "impl_item") return;
    const targetType = node.childForFieldName("type")?.text;
    const traitText = node.childForFieldName("trait")?.text;
    const body = node.childForFieldName("body");
    const methods: MethodDecl[] = [];
    if (body) {
      for (const child of body.namedChildren) {
        if (child.type !== "function_item") continue;
        const returnType = child.childForFieldName("return_type");
        const fnBody = child.childForFieldName("body") ?? undefined;
        methods.push({
          name: child.childForFieldName("name")?.text ?? "",
          visibility: visibilityOf(child),
          receiver: receiverOf(child.childForFieldName("parameters") ?? undefined),
          params: paramsOf(child.childForFieldName("parameters") ?? undefined, targetType),
          ...(returnType ? { return_type_text: returnType.text } : {}),
          body_shape: bodyShapeOf(fnBody),
          span: spanOf(child),
        });
      }
    }
    out.push({
      file,
      target_type_text: targetType ?? "",
      ...(traitText ? { trait_text: traitText } : {}),
      methods,
      span: spanOf(node),
    });
  });
  return out;
}

function isImplMethod(node: TSNode): boolean {
  return node.parent?.type === "declaration_list" && node.parent.parent?.type === "impl_item";
}

function fnFacts(file: string, tree: TSTree): FnDecl[] {
  const out: FnDecl[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "function_item" || isImplMethod(node)) return;
    const returnType = node.childForFieldName("return_type");
    out.push({
      file,
      name: node.childForFieldName("name")?.text ?? "",
      visibility: visibilityOf(node),
      params: paramsOf(node.childForFieldName("parameters") ?? undefined),
      ...(returnType ? { return_type_text: returnType.text } : {}),
      span: spanOf(node),
    });
  });
  return out;
}

function useFacts(file: string, tree: TSTree): UsePath[] {
  const out: UsePath[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "use_declaration") return;
    const argument = node.childForFieldName("argument")?.text ?? node.text.replace(/^use\s+/, "").replace(/;\s*$/, "");
    const pathText = argument.replace(/;\s*$/, "").trim();
    const aliasMatch = /\s+as\s+([A-Za-z0-9_]+)\s*$/.exec(pathText);
    const withoutAlias = aliasMatch ? pathText.replace(/\s+as\s+[A-Za-z0-9_]+\s*$/, "") : pathText;
    const first = withoutAlias.replace(/^::/, "").split("::")[0].replace(/\{.*$/, "").trim();
    out.push({
      file,
      path_text: pathText,
      first_segment: first.replace(/-/g, "_"),
      ...(aliasMatch ? { alias: aliasMatch[1] } : {}),
      span: spanOf(node),
    });
  });
  return out;
}

function callFacts(file: string, tree: TSTree): CallSite[] {
  const out: CallSite[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "call_expression") return;
    const fn = node.childForFieldName("function");
    if (!fn) return;
    if (fn.type === "field_expression") {
      out.push({
        file,
        kind: "method-call",
        callee_text: fn.childForFieldName("field")?.text ?? fn.text,
        receiver_text: fn.childForFieldName("value")?.text ?? "",
        ...(enclosingFn(node) ? { enclosing_fn: enclosingFn(node) } : {}),
        span: spanOf(node),
      });
    } else {
      out.push({
        file,
        kind: "path-call",
        callee_text: fn.text,
        ...(enclosingFn(node) ? { enclosing_fn: enclosingFn(node) } : {}),
        span: spanOf(node),
      });
    }
  });
  return out;
}

function constructionFacts(file: string, tree: TSTree): ConstructionSite[] {
  const out: ConstructionSite[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type === "struct_expression") {
      const hasBase = node.namedChildren.some((child) => child.type === "base_field_initializer");
      out.push({
        file,
        kind: hasBase ? "update-syntax" : "struct-literal",
        type_text: node.childForFieldName("name")?.text ?? node.childForFieldName("type")?.text ?? "",
        ...(enclosingFn(node) ? { enclosing_fn: enclosingFn(node) } : {}),
        span: spanOf(node),
      });
      return;
    }
    if (node.type !== "call_expression") return;
    const fn = node.childForFieldName("function");
    if (fn?.type !== "scoped_identifier") return;
    const typeText = fn.childForFieldName("path")?.text ?? "";
    const callee = fn.childForFieldName("name")?.text ?? "";
    const isDefault = callee === "default" || fn.text === "Default::default";
    out.push({
      file,
      kind: isDefault ? "default-call" : "associated-call",
      type_text: typeText,
      callee_text: callee,
      ...(enclosingFn(node) ? { enclosing_fn: enclosingFn(node) } : {}),
      span: spanOf(node),
    });
  });
  return out;
}

function opaqueFacts(file: string, tree: TSTree): OpaqueRegion[] {
  const out: OpaqueRegion[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type === "ERROR" || node.isMissing) {
      out.push({ file, span: spanOf(node), reason: "parse-error" });
      return;
    }
    if (node.type === "macro_invocation") {
      const parent = node.parent?.type ?? "";
      const itemPosition = parent === "source_file" || parent === "declaration_list" || parent === "mod_item";
      out.push({
        file,
        span: spanOf(node),
        reason: itemPosition ? "macro-item" : "macro-expression",
        macro_name: node.childForFieldName("macro")?.text ?? node.namedChildren[0]?.text ?? "",
      });
      return;
    }
    if (node.type === "attribute_item") {
      const match = /#!?\[\s*([A-Za-z0-9_]+)/.exec(node.text);
      const name = match?.[1];
      if (name && !BUILTIN_ATTRIBUTES.has(name)) {
        out.push({ file, span: spanOf(node), reason: "attribute-macro", macro_name: name });
      }
    }
  });
  return out;
}

export function parse(runtime: AnalyzerRuntime, file: string, bytes: Uint8Array): SyntaxTree {
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const cached = runtime.cache.get(contentHash);
  if (cached) return cached;
  if (runtime.state !== "ready" || !runtime.parser) {
    throw new Error("analyzer runtime is not ready");
  }
  const source = new TextDecoder().decode(bytes);
  const tree = runtime.parser.parse(source);
  if (!tree) throw new Error("tree-sitter returned no tree");
  const opaque = opaqueFacts(file, tree);
  const hasError = tree.rootNode.hasError;
  if (hasError && !opaque.some((region) => region.reason === "parse-error")) {
    opaque.push({ file, span: spanOf(tree.rootNode), reason: "parse-error" });
  }
  const syntaxTree: SyntaxTree = {
    file,
    content_hash: contentHash,
    has_parse_error: hasError,
    opaque_regions: opaque,
  };
  TREES.set(syntaxTree, tree);
  runtime.cache.set(contentHash, syntaxTree);
  return syntaxTree;
}

function requireTree(tree: SyntaxTree): TSTree {
  const internal = TREES.get(tree);
  if (!internal) throw new Error("syntax tree is not attached to a runtime parse");
  return internal;
}

export const structs = (tree: SyntaxTree): StructDecl[] => structFacts(tree.file, requireTree(tree));
export const impls = (tree: SyntaxTree): ImplBlock[] => implFacts(tree.file, requireTree(tree));
export const fns = (tree: SyntaxTree): FnDecl[] => fnFacts(tree.file, requireTree(tree));
export const uses = (tree: SyntaxTree): UsePath[] => useFacts(tree.file, requireTree(tree));
export const calls = (tree: SyntaxTree): CallSite[] => callFacts(tree.file, requireTree(tree));
export const constructions = (tree: SyntaxTree): ConstructionSite[] => constructionFacts(tree.file, requireTree(tree));
export const opaqueRegions = (tree: SyntaxTree): OpaqueRegion[] => tree.opaque_regions;
