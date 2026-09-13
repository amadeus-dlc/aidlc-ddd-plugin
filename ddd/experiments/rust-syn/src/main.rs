mod analysis;

use serde::Deserialize;
use serde_json::json;
use std::io::{self, Read};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    protocol_version: u8,
    files: Vec<Source>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Source {
    path: String,
    source: String,
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin()
        .take(8 * 1024 * 1024 + 1)
        .read_to_string(&mut input)?;
    if input.len() > 8 * 1024 * 1024 {
        return Err("input exceeds the spike's 8 MiB limit".into());
    }
    let input: Input = serde_json::from_str(&input)?;
    if input.protocol_version != 1 || input.files.is_empty() {
        return Err("expected protocol_version 1 and at least one file".into());
    }
    let results: Vec<_> = input
        .files
        .iter()
        .map(|file| analysis::analyze(&file.path, &file.source))
        .collect();
    println!("{}", json!({"protocol_version": 1, "files": results}));
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}
