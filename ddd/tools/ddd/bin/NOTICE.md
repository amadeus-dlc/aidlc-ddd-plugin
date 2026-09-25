# Bundled native extractor

`bin/<platform-key>/ddd-rust-syn-spike` is the Rust declaration extractor every Rust
sensor decides on. It is built from the Rust crate in `ddd/experiments/rust-syn/` and
shipped as a release build, so a gate needs neither `cargo` nor `rustc`.

The crate declares the third-party dependencies below. Versions and license
expressions are the ones `cargo metadata --offline` resolves from the committed
`ddd/experiments/rust-syn/Cargo.lock`.

| Crate | Version | License | Source |
|---|---|---|---|
| `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 | https://crates.io/crates/proc-macro2 |
| `quote` | 1.0.47 | MIT OR Apache-2.0 | https://crates.io/crates/quote |
| `serde` | 1.0.229 | MIT OR Apache-2.0 | https://crates.io/crates/serde |
| `serde_json` | 1.0.151 | MIT OR Apache-2.0 | https://crates.io/crates/serde_json |
| `sha2` | 0.10.9 | MIT OR Apache-2.0 | https://crates.io/crates/sha2 |
| `syn` | 3.0.5 | MIT OR Apache-2.0 | https://crates.io/crates/syn |

These six are what the crate declares, not the whole of what a build resolves: each
pulls in further crates. `Cargo.lock` is the authoritative record of the complete
resolved set for a given build, and which of those crates end up linked into the
executable rather than used only while building it is not determined here.

## Reproducing this list

```sh
cargo metadata --offline --format-version 1 --manifest-path ddd/experiments/rust-syn/Cargo.toml
```

Each package's `name`, `version` and `license` are the columns above. Re-run it after
changing `Cargo.toml` or refreshing `Cargo.lock`.
