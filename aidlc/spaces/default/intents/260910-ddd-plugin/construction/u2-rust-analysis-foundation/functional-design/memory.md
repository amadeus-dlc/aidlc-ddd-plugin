<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-10T11:16:31Z — getter の構文的定義を「本体が self.<field>（参照・clone・as_ref を含む）を返すだけの単一式」とし、body_shape として U2 が返す; 設計書 §6 の「フィールドを返すだけのメソッドは名前に関係なく getter」を構文だけで判定できる形に落とした。境界事例はゴールデンケースで広げる。
- 2026-09-10T11:16:31Z — RMU クレート（例: billing-rmu）は層接尾辞を持たないため、層の列挙に rmu を加えて「層不明」から区別した; ADR-005 は RMU を CQRS 側の印としてしか定めておらず、そのままでは FR9.4 の層不明違反になる。IA 設計書 §4 の「独立ブリッジ」に合わせた解釈。
- 2026-09-10T11:07:42Z — 要件書の未解決事項 OQ7（マクロ展開が必要な箇所の扱い）は決着先が functional-design のため、U2 の質問 Q1 として人間に確定してもらう; 解析器は「解析不能」を明示的に返す（components.md）ことは確定しており、決めるのは報告の重大度だけ。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-10T11:16:31Z — derive は不透明領域にせず StructDecl.derives として返す; derive(Default) は規則 (c) の材料になるため名前を残す価値がある一方、derive の生成物まで不透明扱いにすると全 struct が advisory になり信号が失われる。
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-10T11:16:31Z — web-tree-sitter の同梱方法（vendor ディレクトリとライセンス表記）は code-generation の計画で確定する。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
