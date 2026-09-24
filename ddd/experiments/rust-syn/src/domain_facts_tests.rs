use super::*;

fn check(source: &str) -> Value {
    let answer =
        run(json!({"protocol_version":4,"files":[{"path":"lib.rs","source":source}]})).unwrap();
    assert_eq!(answer["protocol_version"], 4);
    answer["files"][0].clone()
}

/// `type.member@line` for every reported member, in the order the answer lists them.
fn members(source: &str) -> Vec<String> {
    check(source)["members"]
        .as_array()
        .expect("a parsed file reports its members")
        .iter()
        .map(|member| {
            format!(
                "{}.{}@{}",
                member["type"].as_str().unwrap(),
                member["member"].as_str().unwrap(),
                member["line"].as_u64().unwrap()
            )
        })
        .collect()
}

/// `module::owner/trait/name=returns_field_only` for every reported impl method.
fn methods(source: &str) -> Vec<String> {
    check(source)["methods"]
        .as_array()
        .expect("a parsed file reports its methods")
        .iter()
        .map(|method| {
            format!(
                "{}::{}/{}/{}={}",
                method["module"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|part| part.as_str().unwrap())
                    .collect::<Vec<_>>()
                    .join("::"),
                method["owner_type_text"].as_str().unwrap(),
                method["trait_text"].as_str().unwrap_or("-"),
                method["name"].as_str().unwrap(),
                method["returns_field_only"].as_bool().unwrap()
            )
        })
        .collect()
}

fn reasons(source: &str) -> Vec<String> {
    check(source)["unresolved"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| entry["reason"].as_str().unwrap().to_owned())
        .collect()
}

/// `reason@line` for every unresolved record, in the order the answer lists them.
fn reasons_at(source: &str) -> Vec<String> {
    check(source)["unresolved"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            format!(
                "{}@{}",
                entry["reason"].as_str().unwrap(),
                entry["line"].as_u64().unwrap()
            )
        })
        .collect()
}

/// Each prefix a Rust file may carry ahead of its first item, paired with the line the item then
/// occupies in the file a reader opens. `parse_file` consumes both prefixes before it assigns
/// spans, which is the one place a reported line could drift off the file on disk. These cases pin
/// that it does not: a BOM costs no line, and a shebang is cut at its newline rather than past it,
/// so the line the parser counts from is still the line the reader opens.
const PREFIXES: [(&str, u64); 4] = [
    ("", 1),
    ("\u{feff}", 1),
    ("#!/usr/bin/env rust-script\n", 2),
    ("\u{feff}#!/bin/rust\n", 2),
];

#[test]
fn domain_facts_reports_a_public_tuple_member_under_its_ordinal() {
    assert_eq!(members("pub struct Invoice(pub u64);"), ["Invoice.0@1"]);
}

#[test]
fn domain_facts_reports_each_tuple_member_on_its_own_declaration_line() {
    assert_eq!(
        members("pub struct Pair(\n    pub u64,\n    pub(crate) u32,\n    u8,\n);"),
        ["Pair.0@2", "Pair.1@3"]
    );
}

#[test]
fn domain_facts_keeps_a_private_tuple_member_out_of_the_answer() {
    assert_eq!(members("pub struct Amount(u64);"), Vec::<String>::new());
}

#[test]
fn domain_facts_reports_restricted_raw_and_non_ascii_members_as_written() {
    assert_eq!(
        members(
            "mod m { pub struct A { pub(super) x: u64 } }\npub struct B { pub(in crate::m) y: u64 }\npub struct C { pub r#type: u64 }\npub struct D { pub 合計: u64 }"
        ),
        ["A.x@1", "B.y@2", "C.r#type@3", "D.合計@4"]
    );
}

#[test]
fn domain_facts_reads_the_member_line_from_its_visibility_not_its_attributes() {
    assert_eq!(
        members("pub struct Invoice {\n    /// documented\n    #[allow(dead_code)]\n    pub amount: u64,\n}"),
        ["Invoice.amount@4"]
    );
}

#[test]
fn domain_facts_reports_a_member_on_the_line_it_occupies_in_the_original_file() {
    for (prefix, line) in PREFIXES {
        let source = format!("{prefix}pub struct Invoice {{ pub amount: u64 }}\n");
        assert_eq!(
            members(&source),
            [format!("Invoice.amount@{line}")],
            "prefix {prefix:?}"
        );
    }
}

#[test]
fn domain_facts_reports_an_unresolved_construct_on_the_line_it_occupies_in_the_original_file() {
    for (prefix, line) in PREFIXES {
        let source =
            format!("{prefix}pub struct Invoice {{ #[cfg(feature = \"x\")] pub amount: u64 }}\n");
        assert_eq!(
            reasons_at(&source),
            [format!("conditional-compilation@{line}")],
            "prefix {prefix:?}"
        );
    }
}

/// The rejected-file answer reads its line straight from the parse error, so this pins that both
/// answers place a reader on the same line basis whether or not the file could be parsed.
#[test]
fn domain_facts_reports_a_syntax_error_on_the_line_it_occupies_in_the_original_file() {
    for (prefix, line) in PREFIXES {
        let answer = check(&format!("{prefix}pub struct {{"));
        assert_eq!(answer["parsed"], false, "prefix {prefix:?}");
        assert_eq!(
            answer["unresolved"][0],
            json!({"reason": "syntax-error", "line": line}),
            "prefix {prefix:?}"
        );
    }
}

#[test]
fn domain_facts_leaves_enum_and_union_members_out_of_the_answer() {
    assert_eq!(
        members("pub enum Kind { Draft, Paid(u64), Issued { amount: u64 } }\npub union U { pub amount: u64 }"),
        Vec::<String>::new()
    );
}

#[test]
fn domain_facts_does_not_read_a_declaration_out_of_a_macro_body_a_string_or_a_comment() {
    let source = "macro_rules! declare {\n    () => { pub struct Generated { pub amount: u64 } };\n}\nconst DOC: &str = \"pub amount: u64\";\n// pub amount: u64\n";
    assert_eq!(members(source), Vec::<String>::new());
    assert_eq!(reasons(source), Vec::<String>::new());
}

#[test]
fn domain_facts_accepts_both_body_forms_of_a_getter() {
    assert_eq!(
        methods(
            "pub struct Invoice { amount: u64 }\nimpl Invoice {\n    pub fn tail(&self) -> u64 { self.amount }\n    pub fn returned(&self) -> u64 { return self.amount; }\n    pub fn borrowed(&self) -> &u64 { &self.amount }\n    pub fn cloned(&self) -> u64 { self.amount.clone() }\n}"
        ),
        [
            "::Invoice/-/tail=true",
            "::Invoice/-/returned=true",
            "::Invoice/-/borrowed=true",
            "::Invoice/-/cloned=true"
        ]
    );
}

#[test]
fn domain_facts_refuses_bodies_that_do_more_than_hand_back_a_member() {
    assert_eq!(
        methods(
            "pub struct Invoice { amount: u64, inner: Invoice }\nimpl Invoice {\n    pub fn derived(&self) -> u64 { self.amount + 1 }\n    pub fn bound(&self) -> u64 { let x = self.amount; x }\n    pub fn deep(&self) -> u64 { self.inner.amount }\n    pub fn other(&self, peer: &Invoice) -> u64 { peer.amount }\n    pub fn counted(&self) -> usize { self.amount.count_ones() as usize }\n}"
        ),
        [
            "::Invoice/-/derived=false",
            "::Invoice/-/bound=false",
            "::Invoice/-/deep=false",
            "::Invoice/-/other=false",
            "::Invoice/-/counted=false"
        ]
    );
}

#[test]
fn domain_facts_separates_a_trait_implementation_from_an_inherent_one() {
    assert_eq!(
        methods(
            "pub struct Invoice { amount: u64 }\npub trait Shown { fn shown(&self) -> u64; }\nimpl Shown for Invoice { fn shown(&self) -> u64 { self.amount } }\nimpl Invoice { pub fn total(&self) -> u64 { self.amount } }"
        ),
        ["::Invoice/Shown/shown=true", "::Invoice/-/total=true"]
    );
}

#[test]
fn domain_facts_keeps_same_named_methods_of_different_modules_apart() {
    assert_eq!(
        methods(
            "mod a { pub struct Invoice { amount: u64 } impl Invoice { pub fn total(&self) -> u64 { self.amount } } }\nmod b { pub struct Invoice { amount: u64 } impl Invoice { pub fn total(&self) -> u64 { self.amount + 1 } } }"
        ),
        ["a::Invoice/-/total=true", "b::Invoice/-/total=false"]
    );
}

#[test]
fn domain_facts_keeps_a_raw_identifier_method_name_as_written() {
    assert_eq!(
        methods("pub struct Invoice { amount: u64 }\nimpl Invoice { pub fn r#total(&self) -> u64 { self.amount } }"),
        ["::Invoice/-/r#total=true"]
    );
}

#[test]
fn domain_facts_records_the_constructs_that_can_hide_a_declaration() {
    assert_eq!(reasons("declare_invoice!();"), ["macro-expansion"]);
    assert_eq!(
        reasons("pub struct Invoice { #[cfg(feature = \"x\")] pub amount: u64 }"),
        ["conditional-compilation"]
    );
    assert_eq!(
        reasons("pub struct Invoice;\nimpl Invoice { declare_getters!(); }"),
        ["macro-expansion"]
    );
}

#[test]
fn domain_facts_marks_an_unparsed_file_instead_of_reporting_it_as_declaring_nothing() {
    let answer = check("pub struct {");
    assert_eq!(answer["parsed"], false);
    assert!(answer.get("members").is_none());
    assert_eq!(answer["unresolved"][0]["reason"], "syntax-error");
}

#[test]
fn domain_facts_answers_one_record_per_requested_file_in_order() {
    let answer = run(json!({"protocol_version":4,"files":[
        {"path":"b.rs","source":"pub struct B(pub u64);"},
        {"path":"a.rs","source":"pub struct A(pub u64);"}]}))
    .unwrap();
    let files = answer["files"].as_array().unwrap();
    assert_eq!(files.len(), 2);
    assert_eq!(files[0]["path"], "b.rs");
    assert_eq!(files[1]["path"], "a.rs");
}

#[test]
fn domain_facts_refuses_a_request_that_is_not_this_protocol() {
    for request in [
        json!({"protocol_version":1,"files":[{"path":"lib.rs","source":""}]}),
        json!({"protocol_version":4,"files":[]}),
        json!({"protocol_version":4,"files":[{"path":"lib.rs"}]}),
        json!({"protocol_version":4,"files":[{"path":"lib.rs","source":"","extra":true}]}),
    ] {
        assert!(run(request).is_err());
    }
}
