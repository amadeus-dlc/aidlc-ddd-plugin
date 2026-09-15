//! Declarations whose names collide under a flat name table but not under
//! namespace and scope aware resolution. Each one is reachable as the error type
//! of its own operation, so the symbols they resolve to are observable.

pub enum r#type {
    Raw,
}

pub enum Type {
    Plain,
}

pub mod invoice {
    pub enum invoice {
        Nested,
    }
}

pub struct Invoice;

impl Invoice {
    pub fn raw(&mut self) -> core::result::Result<(), r#type> {
        Ok(())
    }

    pub fn plain(&mut self) -> core::result::Result<(), Type> {
        Ok(())
    }

    pub fn nested(&mut self) -> core::result::Result<(), invoice::invoice> {
        Ok(())
    }
}
