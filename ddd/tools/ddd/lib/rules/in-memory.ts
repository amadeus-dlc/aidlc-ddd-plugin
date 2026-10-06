import { layerDeclarationPaths } from "../layer-declaration/document.ts";
import { loadLayerDeclaration } from "../layer-declaration/index.ts";
import type { SensorRunContext } from "../runtime/context.ts";
import type { ModelAvailability } from "./types.ts";

/** Model state elements are never event stream elements, even when imported under an event alias. */
export function isAggregateStateElement(model: ModelAvailability, aggregateRef: string, typeName: string): boolean {
  return (
    model.index
      ?.elements()
      .some(
        (element) =>
          element.owner === aggregateRef &&
          ["entity", "vo", "primitive"].includes(element.kind) &&
          element.name === typeName,
      ) ?? false
  );
}

/** What Event Sourcing keeps in memory: one map of event streams and one map of snapshots, each an aggregate itself. */
export const EVENT_SOURCING_STORAGE =
  "Event Sourcing keeps event streams in one map and snapshots, each the aggregate itself, in another";

/** What a repository's maps lack or repeat of the two Event Sourcing keeps, one phrase for each. */
export function eventSourcingStorageGaps(streams: number, snapshots: number): string[] {
  return [
    ...(streams === 0 ? ["keeps no map of event streams"] : []),
    ...(streams > 1 ? ["keeps more than one map of event streams; keep one"] : []),
    ...(snapshots === 0 ? ["keeps no map of snapshots, the aggregate itself by its id"] : []),
    ...(snapshots > 1 ? ["keeps more than one map of snapshots; keep one"] : []),
  ];
}

/** A stored event stream explicitly states its element type. */
export function eventStreamElement(text: string, language: "rust" | "typescript"): string | undefined {
  if (language === "rust") return /^(?:::)?(?:\w+::)*Vec<(.+)>$/.exec(text)?.[1];
  return /^(?:readonly)?(.+)\[\]$/.exec(text)?.[1] ?? /^(?:[\w$]+\.)*(?:ReadonlyArray|Array)<(.+)>$/.exec(text)?.[1];
}

/** The value argument of an explicitly spelled Map/HashMap, including qualified names. */
export function storedMapValue(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = /^(?:::)?(?:[\w$]+(?:::|\.))*(?:Map|ReadonlyMap|HashMap|BTreeMap)<(.*)>$/.exec(
    text.replace(/\s+/g, ""),
  );
  if (!match) return undefined;
  let depth = 0;
  let valueStart: number | undefined;
  for (let i = 0; i < match[1].length; i++) {
    const char = match[1][i];
    if ("<([{".includes(char)) depth++;
    else if (">)]}".includes(char)) depth--;
    else if (char === "," && depth === 0) {
      if (valueStart !== undefined) return match[1].slice(valueStart, i);
      valueStart = i + 1;
    }
  }
  return valueStart === undefined ? undefined : match[1].slice(valueStart);
}

/** The aggregates whose repository belongs to this package's explicitly declared memory backend. */
export function inMemoryAggregates(
  run: SensorRunContext,
  packageName: string,
  language: "rust" | "typescript",
): ReadonlySet<string> {
  const structures = layerDeclarationPaths(run.record_dir).flatMap((path) => {
    const loaded = loadLayerDeclaration(path);
    return loaded.ok ? loaded.declaration.layer_structures : [];
  });
  return new Set(
    structures
      .filter(
        (entry) =>
          entry.persistence_backend === "in-memory" &&
          entry.packages.some((pkg) => pkg.code.language === language && pkg.code.package === packageName),
      )
      .flatMap((entry) => entry.repositories.map((repository) => repository.aggregate_ref)),
  );
}
