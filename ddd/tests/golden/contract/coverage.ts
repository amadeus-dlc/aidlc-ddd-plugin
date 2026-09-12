import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_CASES } from "../catalog.ts";
import { declaredRules, type GoldenCase } from "../runner.ts";

export const caseKey = (entry: Pick<GoldenCase, "sensor" | "name">) => `${entry.sensor}/${entry.name}`;
export interface CoverageRow {
  sensor: string;
  rule: string;
  normal: string;
  boundary: string;
  reason: { en: string; ja: string };
  preempted?: { by: string; case: string; reason: { en: string; ja: string } };
}
const rows: CoverageRow[] = [];
function cover(sensor: string, rules: string[], normal: string, boundary: string, en: string, ja: string): void {
  for (const rule of rules) rows.push({ sensor, rule, normal, boundary, reason: { en, ja } });
}
const mc = "ddd-model-completeness";
cover(
  mc,
  ["model-completeness.schema"],
  "clean-complete",
  "violation-unresolved-model-reference",
  "Valid model versus a syntactically valid but unresolved model reference.",
  "正常モデルと、形式は正しいが参照先が存在しないモデルを区別する。",
);
cover(
  mc,
  ["model-completeness.i"],
  "clean-complete",
  "violation-i",
  "One invariant versus zero invariants.",
  "不変条件1件と0件の境界。",
);
cover(
  mc,
  ["model-completeness.ii"],
  "clean-complete",
  "clean-no-transition",
  "Declared transitions versus an explicit no-transition command.",
  "遷移ありと、遷移なしを明示したコマンドを区別する。",
);
cover(
  mc,
  ["model-completeness.f-missing", "model-completeness.f-absent"],
  "clean-complete",
  "violation-empty-model-view",
  "An absent document and an existing empty document are different failures.",
  "ファイル欠落と、存在するが空の説明を区別する。",
);
cover(
  mc,
  ["model-completeness.f-unknown"],
  "clean-complete",
  "clean-retired-view-reference",
  "A documented retired ID is allowed; an invented ID is not.",
  "廃止済みIDの記載は許可し、未定義IDの記載は拒否する。",
);
cover(
  mc,
  ["model-completeness.f-invariant"],
  "clean-complete",
  "clean-model-whitespace",
  "Whitespace normalization must not change invariant-statement correspondence.",
  "空白の違いだけで不変条件本文の一致を否定しない。",
);
const mp = "ddd-model-presence";
cover(
  mp,
  ["model-presence.missing"],
  "clean-execute",
  "clean-absent-stage",
  "An absent stage is excluded, while EXECUTE requires a model.",
  "ステージ未登録は対象外、EXECUTEはモデル必須。",
);
cover(
  mp,
  ["model-presence.invalid"],
  "clean-execute",
  "clean-skip",
  "SKIP bypasses model presence; EXECUTE validates it.",
  "SKIP時の対象外と、EXECUTE時の検証を区別する。",
);
for (const [sensor, rule, by, normal] of [
  [mc, "model-completeness.iv", "model-completeness.schema", "clean-complete"],
  [mp, "model-presence.unresolved", "model-presence.invalid", "clean-execute"],
]) {
  cover(
    sensor,
    [rule],
    normal,
    "violation-unresolved-model-reference",
    "The loader rejects unresolved references before this defensive check.",
    "ローダーが未解決参照を先に拒否するため、防御的チェックへは到達しない。",
  );
  rows[rows.length - 1].preempted = {
    by,
    case: "violation-unresolved-model-reference",
    reason: rows[rows.length - 1].reason,
  };
}
const ref = "ddd-reference-ids";
cover(
  ref,
  ["reference-ids.document"],
  "clean-use-case",
  "violation-mixed-headings",
  "English and legacy Japanese headings are aliases, not separate declarations.",
  "英語・従来の日本語見出しは同じ宣言を指し、重複は拒否する。",
);
cover(
  ref,
  ["reference-ids.model"],
  "clean-mapping",
  "violation-document",
  "Declaration parse errors take precedence over model loading.",
  "宣言形式の不正はモデル読込みより先に拒否する。",
);
cover(
  ref,
  ["reference-ids.undefined", "reference-ids.kind"],
  "clean-mapping",
  "clean-replay-reference",
  "Replay event IDs require an event kind, unlike unconstrained reference_ids.",
  "replayはイベント種別を要求し、一般のreference_idsとの違いを確認する。",
);
cover(
  ref,
  ["reference-ids.deprecated", "reference-ids.cycle"],
  "clean-mapping",
  "clean-renamed-lineage",
  "Renaming retains a usable ID; retirement and lineage cycles do not.",
  "名称変更で有効なIDを維持し、廃止や系譜の循環と区別する。",
);
cover(
  ref,
  ["reference-ids.malformed"],
  "clean-mapping",
  "violation-id-arity",
  "Both ID grammar and segment count are validated.",
  "IDの文法とセグメント数の両方を検証する。",
);
cover(
  ref,
  ["reference-ids.missing"],
  "clean-mapping",
  "clean-single-reference",
  "Exactly one mapping reference satisfies the minimum; zero references are rejected.",
  "集約写像の参照1件が最小の正常値で、0件は拒否する。",
);
const mapping = "ddd-mapping-declarations";
cover(
  mapping,
  ["mapping-declarations.document"],
  "clean-use-case",
  "violation-mixed-headings",
  "One canonical section is required across heading languages.",
  "見出しの言語をまたいでも正規セクションは1つだけ。",
);
cover(
  mapping,
  ["mapping-declarations.model"],
  "clean-mapping",
  "violation-document",
  "Malformed declaration stops before model loading.",
  "壊れた宣言はモデル読込み前に拒否する。",
);
cover(
  mapping,
  ["mapping-declarations.aggregate-unmapped", "mapping-declarations.axes", "mapping-declarations.duplicate"],
  "clean-mapping",
  "clean-multi-aggregate-mapping",
  "A valid multi-aggregate actor mapping contrasts with the single class mapping.",
  "複数actor集約の正常な写像と、単一class集約の写像を確認する。",
);
cover(
  mapping,
  ["mapping-declarations.use-case-item"],
  "clean-use-case",
  "clean-empty-use-cases",
  "A complete use case versus an explicit empty list.",
  "必須項目のあるユースケースと、明示的な空一覧を区別する。",
);
cover(
  mapping,
  ["mapping-declarations.multi-aggregate-strategy", "mapping-declarations.process-manager-required"],
  "clean-actor-process-manager",
  "clean-class-re-execution",
  "Actor Process Manager and class re-execution are both represented.",
  "actorのProcess Managerとclassの再実行戦略を両方確認する。",
);
cover(
  mapping,
  ["mapping-declarations.j"],
  "clean-additive-idempotency",
  "clean-mapping",
  "Additive commands require ID memory; transition commands may declare none.",
  "加算型はID記憶必須、状態遷移型はnoneを宣言可能。",
);
const layer = "ddd-layer-structure";
cover(
  layer,
  ["layer-structure.model"],
  "clean",
  "violation-missing-list",
  "Missing declaration lists are rejected before model checks.",
  "一覧の欠落はモデル検査の前に拒否する。",
);
cover(
  layer,
  ["layer-structure.item", "layer-structure.dependencies-incomplete"],
  "clean",
  "clean-empty-layers",
  "A complete layer entry versus an explicitly absent layer design.",
  "完全な層宣言と、明示的に層構造がないUnitを区別する。",
);
cover(
  layer,
  ["layer-structure.cqrs-sides"],
  "clean",
  "clean-non-cqrs",
  "A query side is required only for CQRS declarations.",
  "クエリ側が必須になるCQRSと非CQRSを区別する。",
);
cover(
  layer,
  ["layer-structure.k", "layer-structure.l"],
  "clean-rmu-cross-side",
  "violation-k-reverse",
  "RMU may bridge sides; reverse query dependencies are also checked.",
  "RMUの橋渡しは許可し、クエリ側からの逆方向依存も検出する。",
);
cover(
  layer,
  ["layer-structure.m-name", "layer-structure.m-media"],
  "clean",
  "violation-m-media",
  "A medium-bearing port name violates both exact naming and medium rules.",
  "媒体名入りのポートは正式名と媒体名禁止の両方で違反になる。",
);
cover(
  layer,
  ["layer-structure.n"],
  "clean",
  "clean-collection-repository",
  "Full-constructor restoration still applies when a repository handles a collection.",
  "集合を扱うリポジトリでも完全コンストラクタによる復元を確認する。",
);
const advisory = "ddd-design-advisories";
cover(
  advisory,
  ["design-advisories.document"],
  "clean-use-case",
  "violation-mixed-headings",
  "Malformed declarations produce advisory findings rather than blocking admission.",
  "宣言不正は助言として報告し、承認開始を遮断しない。",
);
cover(
  advisory,
  ["design-advisories.multi-aggregate"],
  "clean-use-case",
  "clean-empty-use-cases",
  "Zero or one target does not trigger the two-aggregate advisory.",
  "対象0件・1件と、2集約以上の助言の境界。",
);
cover(
  advisory,
  ["design-advisories.repository-scope", "design-advisories.store-upsert"],
  "clean",
  "clean-collection-repository",
  "Collection scope is valid; partial aggregate scope is advisory.",
  "集約の集合は有効、集約の一部を扱う宣言は助言対象。",
);
for (const sensor of [mapping, "ddd-rust-domain"]) {
  const code = sensor === "ddd-rust-domain";
  const normal = code ? "clean-packaging-inline" : "clean-packaging-declarations";
  cover(
    sensor,
    ["domain-packaging.declaration"],
    normal,
    code ? "violation-packaging-no-mapping" : "violation-packaging-empty-declarations",
    "Distinguish missing declarations, explicit empty lists, and populated packages.",
    "宣言欠落、明示的な空一覧、パッケージ宣言ありを区別する。",
  );
  cover(
    sensor,
    ["domain-packaging.technical-name"],
    normal,
    code ? "clean-packaging-word-substring" : "violation-package-reserved-VO",
    "Match whole normalized names, including case and raw identifiers, not substrings.",
    "大小文字・raw識別子を正規化して要素全体で照合し、部分文字列では判定しない。",
  );
  cover(
    sensor,
    ["domain-packaging.duplicate"],
    normal,
    code ? "clean-packaging-planned-module" : "violation-packaging-duplicate",
    "Future distinct packages may be declared; duplicate identities are rejected.",
    "異なる将来パッケージは先行宣言可能だが、同じ識別子の重複は拒否する。",
  );
  cover(
    sensor,
    ["domain-packaging.coverage"],
    normal,
    code ? "clean-packaging-planned-module" : "violation-packaging-missing-parent",
    "Require roots and ancestors without requiring future modules to exist now.",
    "rootと親階層を必須にし、将来のモジュールの即時実装は要求しない。",
  );
}
const domain = "ddd-rust-domain";
cover(
  domain,
  ["domain-packaging.reference"],
  "clean-packaging-inline",
  "violation-model-invalid",
  "An unreadable canonical model is not treated as valid package references.",
  "正規モデルを読めなければパッケージ参照も検証済みと扱わない。",
);
cover(
  domain,
  ["domain-packaging.unresolved"],
  "clean-packaging-path-child",
  "violation-module-cycle",
  "Follow explicit module paths and stop on cycles instead of recursing forever.",
  "明示的なpathをたどり、循環は停止して報告する。",
);
cover(
  domain,
  ["a"],
  "clean-domain",
  "violation-a",
  "Private versus public fields on the same aggregate.",
  "同じ集約の非公開フィールドと公開フィールドを比較する。",
);
cover(
  domain,
  ["b"],
  "clean-b-split-command",
  "clean-b-declared-replay",
  "A declared command and explicitly matched replay are both permitted.",
  "宣言済みコマンドと、契約に一致するreplayを許可する。",
);
cover(
  domain,
  ["c"],
  "clean-full-constructor",
  "violation-c-default",
  "Construction inside an inherent impl versus Default bypass.",
  "inherent impl内の生成とDefaultによる迂回を区別する。",
);
cover(
  domain,
  ["d"],
  "clean-self-getter",
  "violation-d-split-getter",
  "Self calls remain allowed; cross-file receivers still resolve.",
  "self呼出しは許可し、別ファイルの受信型も照合する。",
);
for (const sensor of [domain, "ddd-rust-use-case", "ddd-rust-interface-adapter"]) {
  const from = sensor.replace("ddd-rust-", "");
  cover(
    sensor,
    ["g"],
    `clean-g-${from}-to-infrastructure-use`,
    `clean-g-${from}-to-infrastructure-cargo`,
    "Test the independent layer permission table through use paths and Cargo-only dependencies, including external I/O.",
    "独立した層の許可表をuseとCargoのみの依存で検証し、外部I/Oも含める。",
  );
}
for (const rule of ["layer.unknown", "layer.conflict", "layer.mixed-targets", "layer.unowned"])
  cover(
    domain,
    [rule],
    "clean-domain",
    `violation-${rule.replaceAll(".", "-")}`,
    "Exercise the concrete diagnostic rather than exempting the layer.* family.",
    "layer.*を一括除外せず、具体的な診断ごとに検証する。",
  );
cover(
  domain,
  ["model.invalid"],
  "clean-domain",
  "clean-model-skipped",
  "EXECUTE validates the model; SKIP records the model-dependent exclusion.",
  "EXECUTEのモデル検証と、SKIPによるモデル依存検査の対象外を区別する。",
);
const use = "ddd-rust-use-case";
cover(
  use,
  ["h"],
  "clean-h-value-object",
  "clean-h-domain-primitive",
  "Value objects and Domain Primitives are valid execute arguments; aggregates are not.",
  "VOとDomain Primitiveの引数は許可し、集約引数は拒否する。",
);
cover(
  use,
  ["i"],
  "clean-i-port-execute",
  "clean-i-own-associated-call",
  "Port and same-type calls are not another concrete use case.",
  "ポート呼出しと同型自身への呼出しを別ユースケースと混同しない。",
);
cover(
  use,
  ["d"],
  "clean-d-unrelated-getter-name",
  "violation-d-getter-alias",
  "Receiver identity matters even with name collisions or import aliases.",
  "名前の衝突やimport別名があっても受信型の同一性で判定する。",
);
const adapter = "ddd-rust-interface-adapter";
cover(
  adapter,
  ["k"],
  "clean-rmu-bridge",
  "violation-k-reverse",
  "RMU bridge is allowed; both command/query directions are prohibited otherwise.",
  "RMUの橋渡しを許可し、それ以外はcommand/query両方向を禁止する。",
);
cover(
  adapter,
  ["l"],
  "clean-query-dto",
  "violation-l",
  "A query DTO is allowed; an update-domain type is not.",
  "クエリDTOは許可し、更新用ドメイン型は拒否する。",
);
cover(
  adapter,
  ["m"],
  "clean-repository",
  "clean-storage-implementation-name",
  "Medium names may appear on implementations but not repository port traits.",
  "実装名の媒体名は許可し、リポジトリポートのtraitでは拒否する。",
);
cover(
  adapter,
  ["n"],
  "clean-restoration-constructor",
  "violation-default-restoration",
  "A known full constructor is allowed; Default restoration is not.",
  "既知の完全コンストラクタを許可し、Defaultによる復元は拒否する。",
);
export const COVERAGE = rows;

export function violations(row: CoverageRow, cases: readonly GoldenCase[] = ALL_CASES): GoldenCase[] {
  if (row.preempted)
    return cases.filter(
      (entry) =>
        entry.sensor === row.sensor &&
        entry.name === row.preempted?.case &&
        entry.expect.rules.includes(row.preempted.by),
    );
  return cases.filter(
    (entry) => entry.sensor === row.sensor && !entry.expect.pass && entry.expect.rules.includes(row.rule),
  );
}
export function declaredContract(): Map<string, Set<string>> {
  const directory = join(import.meta.dir, "../../../sensors");
  const declared = declaredRules(
    directory,
    readdirSync(directory).filter((name) => name.endsWith(".md")),
  );
  return declared;
}
export function coverageProblems(
  cases: readonly GoldenCase[] = ALL_CASES,
  matrix: readonly CoverageRow[] = COVERAGE,
): string[] {
  const issues: string[] = [];
  const lookup = new Map(cases.map((entry) => [caseKey(entry), entry]));
  if (lookup.size !== cases.length) issues.push("Duplicate sensor/case identities");
  const declared = declaredContract();
  for (const [sensor, rules] of declared)
    for (const rule of rules) {
      if (matrix.filter((row) => row.sensor === sensor && row.rule === rule).length !== 1)
        issues.push(`Expected one coverage row: ${sensor}/${rule}`);
    }
  for (const row of matrix) {
    const key = `${row.sensor}/${row.rule}`;
    if (!declared.get(row.sensor)?.has(row.rule)) issues.push(`Undeclared matrix rule: ${key}`);
    const normal = lookup.get(`${row.sensor}/${row.normal}`);
    const boundary = lookup.get(`${row.sensor}/${row.boundary}`);
    if (!normal?.expect.pass || normal.expect.rules.length > 0) issues.push(`Missing positive case: ${key}`);
    if (!boundary || boundary.name === row.normal || !row.reason.en || !row.reason.ja)
      issues.push(`Missing distinct boundary or rationale: ${key}`);
    if (violations(row, cases).length === 0) issues.push(`Missing negative case: ${key}`);
    if (
      row.preempted &&
      (!declared.get(row.sensor)?.has(row.preempted.by) || !row.preempted.reason.en || !row.preempted.reason.ja)
    )
      issues.push(`Invalid preemption: ${key}`);
  }
  return issues;
}
export function gateCases(): GoldenCase[] {
  const keys = new Set<string>();
  for (const row of COVERAGE) {
    for (const name of [row.normal, row.boundary, violations(row)[0]?.name])
      if (name) keys.add(`${row.sensor}/${name}`);
  }
  return ALL_CASES.filter((entry) => keys.has(caseKey(entry)));
}
