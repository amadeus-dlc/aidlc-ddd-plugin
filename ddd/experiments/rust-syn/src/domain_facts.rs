//! Version 4 domain facts: the decision base of the public-member rule (a) and the getter rule
//! (d). Source is never compiled or executed.
//!
//! One batch carries every source of the inspected program, and the answer carries one record per
//! requested file. A record names the non-private members of each struct declaration and, for every
//! impl method, whether its body hands back one of `self`'s own members. The rule layer joins those
//! method facts onto its own declarations, so this module reports the identity the join needs
//! (module path, self type, implemented trait, method name) and never a resolved type.
use quote::ToTokens;
use serde::Deserialize;
use serde_json::{json, Value};
use syn::{
    spanned::Spanned,
    visit::{self, Visit},
};

#[cfg(test)]
#[path = "domain_facts_tests.rs"]
mod tests;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    protocol_version: u8,
    files: Vec<super::Source>,
}

fn text(value: &impl ToTokens) -> String {
    value.to_token_stream().to_string()
}

/// Identifiers keep the spelling the source uses, raw prefix included: the rule layer joins these
/// names against the same spellings its own extractor reports, and reports them to the reader.
fn spelling(value: &syn::Ident) -> String {
    value.to_string()
}

/// Syntax evidence that the body hands back one of `self`'s own members. It is not a proof that
/// the method has no other effect.
fn field_return(expr: &syn::Expr) -> bool {
    match expr {
        syn::Expr::Field(field) => {
            matches!(&*field.base, syn::Expr::Path(path) if path.path.is_ident("self"))
        }
        syn::Expr::Paren(expr) => field_return(&expr.expr),
        syn::Expr::Reference(expr) => expr.mutability.is_none() && field_return(&expr.expr),
        syn::Expr::Return(expr) => expr.expr.as_deref().is_some_and(field_return),
        syn::Expr::MethodCall(call) => {
            call.args.is_empty()
                && ["clone", "as_ref", "as_deref", "to_owned", "to_string"]
                    .contains(&call.method.to_string().as_str())
                && field_return(&call.receiver)
        }
        _ => false,
    }
}

fn returns_field_only(block: &syn::Block) -> bool {
    matches!(block.stmts.as_slice(), [syn::Stmt::Expr(expr, _)] if field_return(expr))
}

/// Lines are the original file's. `parse_file` drops a BOM without dropping a line, and cuts a
/// shebang at its newline rather than past it, so the line it parses from keeps standing in for the
/// line the reader opens. The rejected-file answer reads its line from the parse error the same
/// way, which is why both answers put a reader on the same line of the same file.
fn line(span: proc_macro2::Span) -> usize {
    span.start().line
}

struct Facts {
    module: Vec<String>,
    members: Vec<Value>,
    methods: Vec<Value>,
    unresolved: Vec<Value>,
}

impl Facts {
    fn new() -> Self {
        Self {
            module: Vec::new(),
            members: Vec::new(),
            methods: Vec::new(),
            unresolved: Vec::new(),
        }
    }

    /// Only the constructs that can add or remove a declaration these rules read are recorded.
    /// An attribute or derive macro cannot change the members of the declaration it annotates, so
    /// it is a documented limit of this protocol rather than a per-occurrence record.
    fn unresolved(&mut self, reason: &str, span: proc_macro2::Span) {
        self.unresolved
            .push(json!({"reason": reason, "line": line(span)}));
    }
}

impl<'ast> Visit<'ast> for Facts {
    fn visit_item_struct(&mut self, node: &'ast syn::ItemStruct) {
        for (index, field) in node.fields.iter().enumerate() {
            if matches!(field.vis, syn::Visibility::Inherited) {
                continue;
            }
            // A tuple member has no identifier, so its ordinal names it.
            let member = field
                .ident
                .as_ref()
                .map(spelling)
                .unwrap_or_else(|| index.to_string());
            // The visibility is what makes the member reportable, and it opens the declaration on
            // the line a reader is sent to; the field's own span would start at its attributes.
            let line = line(field.vis.span());
            self.members
                .push(json!({"type": spelling(&node.ident), "member": member, "line": line}));
        }
        visit::visit_item_struct(self, node);
    }

    fn visit_item_impl(&mut self, node: &'ast syn::ItemImpl) {
        let owner = text(&node.self_ty);
        let implemented = node.trait_.as_ref().map(|(path, _)| text(path));
        for item in &node.items {
            if let syn::ImplItem::Fn(method) = item {
                self.methods.push(json!({
                    "module": self.module, "owner_type_text": owner, "trait_text": implemented,
                    "name": spelling(&method.sig.ident),
                    // Two declarations of one name are separate methods: a function body may hold
                    // its own type, and the module path does not name the function it sits in. The
                    // name's own line tells them apart, and it is the line the other extractor
                    // reads for the same declaration.
                    "line": line(method.sig.ident.span()),
                    "returns_field_only": returns_field_only(&method.block)
                }));
            } else if let syn::ImplItem::Macro(item) = item {
                self.unresolved("macro-expansion", item.span());
            }
        }
        visit::visit_item_impl(self, node);
    }

    fn visit_item_mod(&mut self, node: &'ast syn::ItemMod) {
        self.module.push(spelling(&node.ident));
        visit::visit_item_mod(self, node);
        self.module.pop();
    }

    fn visit_item_macro(&mut self, node: &'ast syn::ItemMacro) {
        // A named item macro is a `macro_rules!` definition: it declares nothing by itself.
        if node.ident.is_none() {
            self.unresolved("macro-expansion", node.span());
        }
        visit::visit_item_macro(self, node);
    }

    fn visit_attribute(&mut self, node: &'ast syn::Attribute) {
        let path = node.path();
        if path.is_ident("cfg") || path.is_ident("cfg_attr") {
            self.unresolved("conditional-compilation", node.span());
        }
        visit::visit_attribute(self, node);
    }
}

/// A file the parser rejected carries no `members` key at all: an empty member list would read as
/// "this file declares nothing public", which is the one answer an uninspected file must not give.
fn analyze(path: &str, source: &str) -> Value {
    let parsed = match syn::parse_file(source) {
        Ok(file) => file,
        Err(error) => {
            return json!({"path": path, "parsed": false, "methods": [],
                "unresolved": [{"reason": "syntax-error", "line": error.span().start().line}]});
        }
    };
    let mut facts = Facts::new();
    facts.visit_file(&parsed);
    json!({"path": path, "parsed": true, "members": facts.members,
        "methods": facts.methods, "unresolved": facts.unresolved})
}

pub fn run(value: Value) -> Result<Value, Box<dyn std::error::Error>> {
    let request: Request = serde_json::from_value(value)?;
    if request.protocol_version != 4 || request.files.is_empty() {
        return Err("expected protocol_version 4 and at least one file".into());
    }
    let files: Vec<_> = request
        .files
        .iter()
        .map(|file| analyze(&file.path, &file.source))
        .collect();
    Ok(json!({"protocol_version": 4, "files": files}))
}
