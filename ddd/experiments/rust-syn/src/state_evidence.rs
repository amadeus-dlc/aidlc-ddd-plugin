//! Version 2 syntax evidence. Source is never compiled or executed.
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use syn::spanned::Spanned;

#[cfg(test)]
#[path = "state_evidence_tests.rs"]
mod tests;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Target {
    file: String,
    #[serde(rename = "declarationPath")]
    declaration_path: Vec<String>,
    representation: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    protocol_version: u8,
    request_identity: String,
    files: Vec<super::Source>,
    target: Target,
    settings: Value,
}

fn location(span: proc_macro2::Span) -> Value {
    let range = span.byte_range();
    json!({"byte_start": range.start, "byte_end": range.end})
}

fn uncertain(attrs: &[syn::Attribute]) -> bool {
    attrs.iter().any(|attr| !attr.path().is_ident("doc"))
}

fn unresolved(code: &str) -> Value {
    json!({"target_status": "unresolved", "reasons": [code]})
}

fn identify(items: &[syn::Item], path: &[String]) -> Value {
    let candidates: Vec<_> = items
        .iter()
        .filter(|item| match item {
            syn::Item::Struct(item) => {
                path.len() == 1 && item.ident.to_string().trim_start_matches("r#") == path[0]
            }
            syn::Item::Mod(item) => item.ident.to_string().trim_start_matches("r#") == path[0],
            syn::Item::Enum(item) => item.ident.to_string().trim_start_matches("r#") == path[0],
            syn::Item::Union(item) => item.ident.to_string().trim_start_matches("r#") == path[0],
            syn::Item::Type(item) => item.ident.to_string().trim_start_matches("r#") == path[0],
            syn::Item::Trait(item) => item.ident.to_string().trim_start_matches("r#") == path[0],
            _ => false,
        })
        .collect();
    if candidates.len() > 1 {
        return unresolved("target-ambiguous");
    }
    // Macros in this namespace may create or duplicate the requested declaration.
    if items.iter().any(|item| matches!(item, syn::Item::Macro(_))) {
        return unresolved("unsupported-syntax");
    }
    match candidates.first() {
        None => unresolved("target-missing"),
        Some(syn::Item::Mod(item)) if path.len() > 1 => {
            if uncertain(&item.attrs) {
                return unresolved("unsupported-syntax");
            }
            match &item.content {
                Some((_, items)) => identify(items, &path[1..]),
                None => unresolved("unsupported-syntax"),
            }
        }
        Some(syn::Item::Struct(item)) => extract(item, path),
        _ => unresolved("unsupported-syntax"),
    }
}

fn extract(item: &syn::ItemStruct, _path: &[String]) -> Value {
    if uncertain(&item.attrs) {
        return unresolved("unsupported-syntax");
    }
    let members: Vec<_> = item.fields.iter().enumerate().map(|(index, field)| {
        let name = field.ident.as_ref().map(|id| format!("field:{}", id.to_string().trim_start_matches("r#")))
            .unwrap_or_else(|| format!("tuple:{index}"));
        if uncertain(&field.attrs) {
            json!({"name": name, "status": "unresolved", "reason": "unsupported-syntax", "location": location(field.span())})
        } else {
            json!({"name": name, "status": "resolved", "exposed": !matches!(field.vis, syn::Visibility::Inherited), "location": location(field.span())})
        }
    }).collect();
    json!({"target_status": "resolved", "target_location": location(item.span()),
        "members": members, "completeness": "complete", "reasons": []})
}

pub fn run(value: Value) -> Result<Value, Box<dyn std::error::Error>> {
    let target = value.get("target").cloned().ok_or("missing target")?;
    let request: Request = serde_json::from_value(value)?;
    if request.protocol_version != 2
        || request.files.is_empty()
        || request.target.declaration_path.is_empty()
        || request.target.declaration_path.iter().any(String::is_empty)
        || request.target.representation != "rust-struct"
        || !request.settings.is_object()
        || !request.request_identity.starts_with("sha256:")
        || request.request_identity.len() != 71
    {
        return Err("invalid version 2 request".into());
    }
    let files: Vec<_> = request
        .files
        .iter()
        .filter(|file| file.path == request.target.file)
        .collect();
    if files.len() != 1 {
        return Err("target file must occur exactly once".into());
    }
    let source = &files[0].source;
    let evidence = match syn::parse_file(source) {
        Ok(_) if !request.settings.as_object().unwrap().is_empty() => {
            unresolved("unsupported-syntax")
        }
        Ok(file) if uncertain(&file.attrs) => unresolved("unsupported-syntax"),
        Ok(file) => {
            let offset = usize::from(source.starts_with('\u{feff}')) * 3
                + file.shebang.as_ref().map_or(0, String::len);
            let mut evidence = identify(&file.items, &request.target.declaration_path);
            shift_locations(&mut evidence, offset);
            evidence
        }
        Err(_) => unresolved("syntax-error"),
    };
    let mut result = evidence.as_object().unwrap().clone();
    result.insert("protocol_version".into(), json!(2));
    result.insert("request_identity".into(), json!(request.request_identity));
    result.insert(
        "source_digest".into(),
        json!(format!("sha256:{:x}", Sha256::digest(source.as_bytes()))),
    );
    result.insert("target".into(), target);
    Ok(Value::Object(result))
}

// syn::parse_file removes the BOM and shebang before assigning token spans.
fn shift_locations(value: &mut Value, offset: usize) {
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if key == "byte_start" || key == "byte_end" {
                    *value = json!(value.as_u64().unwrap() + offset as u64);
                } else {
                    shift_locations(value, offset);
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                shift_locations(value, offset);
            }
        }
        _ => {}
    }
}
