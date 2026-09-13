import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 本番の記録や設定を変更せず、一時ディレクトリの検査入力だけで比較する。
// 終了コード0は両形式が期待どおり合格、1は少なくとも一方が未合格を表す。
const fixtureRoot = mkdtempSync(join(tmpdir(), "aidlc-traceability-fr-"));
const directory = "260913-traceability-probe";
const observations = [];
for (const [name, id] of [["requirement", "FR1"], ["story-control", "US1.1"]]) {
  const workspace = join(fixtureRoot, name);
  const roof = join(workspace, "aidlc");
  const intents = join(roof, "spaces/default/intents");
  const record = join(intents, directory);
  const stage = join(record, "inception/units-generation");
  mkdirSync(stage, {recursive:true});
  mkdirSync(join(record, "inception/requirements-analysis"), {recursive:true});
  mkdirSync(join(workspace, ".codex"), {recursive:true});
  await Bun.write(join(roof,"active-space"),"default\n");
  await Bun.write(join(intents,"active-intent"),directory+"\n");
  await Bun.write(join(intents,"intents.json"),JSON.stringify([{
    uuid:"019f0000-0000-7000-8000-000000000001",slug:"traceability-probe",
    dirName:directory,scope:"express",status:"active",
  }],null,2)+"\n");
  // 検査入力の位置を解決するための架空の最小記録。承認・監査イベントは作らない。
  await Bun.write(join(record,"aidlc-state.md"),`# AI-DLC State Tracking

## Project Information
- **Project**: 独立した対応表検証の入力
- **Project Type**: Greenfield
- **Scope**: express

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: units-generation
- **Status**: Running
`);
  await Bun.write(join(record,"inception/requirements-analysis/requirements.md"),"# 検証用要件\n\n## Functional Requirements\n\n### FR1: 状態公開を判定する\n\n指定した型の状態公開を検査する。\n");
  if (id.startsWith("US")) {
    mkdirSync(join(record,"inception/user-stories"),{recursive:true});
    await Bun.write(join(record,"inception/user-stories/stories.md"),"# 検証用ストーリー\n\n## US1.1: 状態公開を確認する\n\n開発者が指定した型の検査結果を確認する。\n");
  }
  await Bun.write(join(stage,"unit-of-work.md"),"# 検証用単位\n\n## Units\n\n| Unit ID | Directory | Kind |\n|---|---|---|\n| U1 | u1-inspection | library |\n");
  await Bun.write(join(stage,"unit-of-work-dependency.md"),"# 依存\n\n## Units\n\n```yaml\nunits:\n  - name: u1-inspection\n    kind: library\n    depends_on: []\n```\n");
  await Bun.write(join(stage,"unit-of-work-story-map.md"),`# 対応\n\n## Mapping\n\n| Requirement ID | Unit ID | Directory |\n|---|---|---|\n| ${id} | U1 | u1-inspection |\n`);
  const traceability = join(stage,"traceability.json");
  await Bun.write(traceability,JSON.stringify({stage:"units-generation",upstream_ids:[id],coverage:[{id,status:"OK",target:"U1"}]},null,2)+"\n");
  const command=["aidlc","engine","sensor-traceability","--output-path",traceability,"--stage","units-generation"];
  const result=Bun.spawnSync(command,{cwd:workspace,env:{...process.env,AIDLC_HARNESS_DIR:".codex"},stdout:"pipe",stderr:"pipe"});
  const stdout=result.stdout.toString();
  let verdict;try{verdict=JSON.parse(stdout);}catch{verdict={pass:false,raw:stdout};}
  observations.push({name,id,expectedPass:true,exitCode:result.exitCode,verdict,stderr:result.stderr.toString()});
}
const version=Bun.spawnSync(["aidlc","--version"],{stdout:"pipe",stderr:"pipe"});
const report={version:version.stdout.toString().trim(),fixtureRoot,observations};
await Bun.write(join(fixtureRoot,"results.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if (observations.some(x=>x.exitCode!==0||x.verdict.pass!==true)) process.exitCode=1;
