/**
 * Owns how a validated selection is spelled inside an inspection input, and reads that spelling back
 * for the TypeScript extractor. Depends on the settings contract and the inspection contract types
 * only: no syntax tree, type checker or file I/O. The native Rust extractor restates the same
 * vocabulary in Rust, and its own tests hold it to this spelling.
 */

import type { JsonValue, Target } from "../state-exposure/index.ts";
import type {
  ProjectLanguage,
  ProjectSelection,
  RustModuleLayout,
  RustSelection,
  TypeScriptCodeRepresentation,
  TypeScriptModuleLayout,
  TypeScriptSelection,
} from "./contract.ts";
import {
  isTable,
  LANGUAGES,
  RUST_MODULE_LAYOUTS,
  SCHEMA_VERSION,
  TYPESCRIPT_CODE_REPRESENTATIONS,
  TYPESCRIPT_MODULE_LAYOUTS,
} from "./contract.ts";

const PAYLOAD_KEY = "projectSettings";
export const TARGET_REPRESENTATION: Record<TypeScriptCodeRepresentation, Target["representation"]> = {
  class: "ts-class",
  companion: "ts-companion",
};

type Settings = { readonly [key: string]: JsonValue };

export function projectSettingsPayload(selection: ProjectSelection): Settings {
  return {
    [PAYLOAD_KEY]: {
      version: SCHEMA_VERSION,
      languages: [...selection.languages],
      ...(selection.rust ? { rust: { moduleLayout: selection.rust.moduleLayout } } : {}),
      ...(selection.typescript
        ? {
            typescript: {
              moduleLayout: selection.typescript.moduleLayout,
              codeRepresentation: selection.typescript.codeRepresentation,
            },
          }
        : {}),
    },
  };
}

function rustChoice(value: unknown): RustSelection | null {
  if (!isTable(value) || Object.keys(value).length !== 1) return null;
  const moduleLayout = value.moduleLayout;
  if (typeof moduleLayout !== "string" || !RUST_MODULE_LAYOUTS.includes(moduleLayout as RustModuleLayout)) return null;
  return { moduleLayout: moduleLayout as RustModuleLayout };
}

function typeScriptChoice(value: unknown): TypeScriptSelection | null {
  if (!isTable(value) || Object.keys(value).length !== 2) return null;
  const moduleLayout = value.moduleLayout;
  const codeRepresentation = value.codeRepresentation;
  if (typeof moduleLayout !== "string" || !TYPESCRIPT_MODULE_LAYOUTS.includes(moduleLayout as TypeScriptModuleLayout))
    return null;
  if (
    typeof codeRepresentation !== "string" ||
    !TYPESCRIPT_CODE_REPRESENTATIONS.includes(codeRepresentation as TypeScriptCodeRepresentation)
  )
    return null;
  return {
    moduleLayout: moduleLayout as TypeScriptModuleLayout,
    codeRepresentation: codeRepresentation as TypeScriptCodeRepresentation,
  };
}

function parsePayload(settings: Settings): ProjectSelection | null {
  const keys = Object.keys(settings);
  if (keys.length !== 1 || keys[0] !== PAYLOAD_KEY) return null;
  const payload = settings[PAYLOAD_KEY];
  if (!isTable(payload)) return null;
  if (Object.keys(payload).some((key) => !["version", "languages", ...LANGUAGES].includes(key))) return null;
  if (payload.version !== SCHEMA_VERSION) return null;
  const languages = payload.languages;
  if (!Array.isArray(languages) || languages.length === 0) return null;
  if (languages.some((name) => !LANGUAGES.includes(name as ProjectLanguage))) return null;

  const rustEnabled = languages.includes("rust");
  if (Object.hasOwn(payload, "rust") !== rustEnabled) return null;
  const rust = rustEnabled ? rustChoice(payload.rust) : null;
  if (rustEnabled && rust === null) return null;

  const typeScriptEnabled = languages.includes("typescript");
  if (Object.hasOwn(payload, "typescript") !== typeScriptEnabled) return null;
  const typescript = typeScriptEnabled ? typeScriptChoice(payload.typescript) : null;
  if (typeScriptEnabled && typescript === null) return null;

  return { languages: LANGUAGES.filter((name) => languages.includes(name)), rust, typescript };
}

/**
 * Decides whether the TypeScript extractor may continue. Empty settings are the state-exposure
 * baseline every existing case carries. Anything else must be exactly this payload, must put
 * TypeScript in use, and must name the representation being inspected, so settings that bypassed the
 * binder are reported as unresolved rather than silently ignored.
 */
export function acceptsTypeScriptSettings(settings: Settings, representation: Target["representation"]): boolean {
  if (Object.keys(settings).length === 0) return true;
  const selection = parsePayload(settings);
  if (selection === null) return false;
  return (
    selection.typescript !== null && representation === TARGET_REPRESENTATION[selection.typescript.codeRepresentation]
  );
}
