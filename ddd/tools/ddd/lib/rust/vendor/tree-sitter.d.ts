/**
 * Minimal type surface for the vendored web-tree-sitter runtime
 * (vendor/tree-sitter.js, web-tree-sitter 0.25.10, MIT). Only the members the
 * Rust analyzer uses are declared; the full upstream types are kept in
 * web-tree-sitter.types.d.ts for reference.
 */

export interface TSPoint {
  row: number;
  column: number;
}

export interface TSNode {
  type: string;
  text: string;
  startPosition: TSPoint;
  endPosition: TSPoint;
  isMissing: boolean;
  hasError: boolean;
  namedChildren: TSNode[];
  children: TSNode[];
  parent: TSNode | null;
  previousNamedSibling: TSNode | null;
  childForFieldName(name: string): TSNode | null;
}

export interface TSTree {
  rootNode: TSNode;
  delete(): void;
}

export interface TSLanguage {
  name: string | null;
  version: number;
}

export interface TSParser {
  setLanguage(language: TSLanguage): void;
  parse(input: string): TSTree | null;
  delete(): void;
}

export declare const Parser: {
  init(options?: { locateFile?: (name: string) => string }): Promise<void>;
  new (): TSParser;
};

export declare const Language: {
  load(path: string): Promise<TSLanguage>;
};
