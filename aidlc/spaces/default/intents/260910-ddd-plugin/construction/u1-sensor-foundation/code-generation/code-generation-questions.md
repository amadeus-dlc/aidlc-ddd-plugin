# Code Generation — 確認事項（U1 センサー基盤 / u1-sensor-foundation）

## Sources

- `construction/u1-sensor-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API 面）
- `construction/u1-sensor-foundation/functional-design/rules.md`（BR1〜BR9）
- `construction/u1-sensor-foundation/functional-design/entities.md`（DomainModelSchema 15 型 / SensorRuntime 4 型）
- `construction/u1-sensor-foundation/functional-design/functional-design-questions.md`（Q1 ID 接頭辞、Q2 系譜の置き場所、Q3 effect 属性、Q4 手書き検証器 — いずれも回答済み）
- `inception/units-generation/unit-of-work.md`（U1 = SensorRuntime + DomainModelSchema、kind: library、複雑度 M）
- `inception/requirements-analysis/requirements.md`（FR2.1〜FR2.7、FR8.5、NFR1、NFR2、NFR8、NFR9）

## 前提

本 Unit の実装はすでに作業ツリー上に存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
したがって本ステージは**既存実装を code-generation の成果として記録する**ものであり、
新規のコード生成も既存ファイルの改変も行わない。計画の各ステップは完了済みとして記録される。

---

## Plan Approval

承認対象は次の 3 つである。

1. `construction/u1-sensor-foundation/code-generation/code-generation-plan.md`（埋め込みの Testing Contract を含む）
2. `construction/u1-sensor-foundation/code-generation/unit-test-instructions.md`
3. 上記 2 つに埋め込まれた Testing Contract（`contract_sha256: sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386`）

[Approval Fingerprint]: sha256:v3:889c492f806be102583f5bebd8cdec6af7c798b5312cad26a36cde34ecffa5f7
[Planned Source]: b063ca4bd981212ccfe0b31ed86d3b077cc83e836af7d635b92530fbd2c110e6

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
