//! Shapes whose resolution is bounded. Each inline module isolates one reason so
//! that an item macro or an unknown condition in one of them cannot widen the
//! others.

/// An application type named `Result`. Inside this module it shadows the prelude,
/// so the spelling alone never establishes the standard result identity.
pub mod shadowed {
    pub struct Result<T, E>(pub T, pub E);

    pub struct Invoice;

    impl Invoice {
        pub fn issue(&mut self) -> Result<(), crate::errors::IssueInvoiceError> {
            Result((), crate::errors::IssueInvoiceError::Empty)
        }
    }
}

/// An error whose case set is deliberately left open.
pub mod open {
    #[non_exhaustive]
    pub enum OpenError {
        Known,
    }

    pub struct Invoice;

    impl Invoice {
        pub fn issue(&mut self) -> core::result::Result<(), OpenError> {
            Ok(())
        }
    }
}

/// A case selected by a condition that is not part of the build condition.
pub mod unknown_condition {
    pub enum CfgError {
        Known,
        #[cfg(fuzzing)]
        Unknown,
    }

    pub struct Invoice;

    impl Invoice {
        pub fn issue(&mut self) -> core::result::Result<(), CfgError> {
            Ok(())
        }
    }
}

/// An error declaration produced by a macro that is never expanded here.
pub mod generated {
    macro_rules! declare_error {
        () => {
            pub enum MacroError {
                Generated,
            }
        };
    }

    declare_error!();

    pub struct Invoice;

    impl Invoice {
        pub fn issue(&mut self) -> core::result::Result<(), MacroError> {
            Ok(())
        }
    }
}

/// An error type reached through an associated type of the implementing type.
pub mod projection {
    pub trait Failing {
        type Error;

        fn issue(&mut self) -> core::result::Result<(), Self::Error>;
    }

    pub struct Invoice;

    impl Failing for Invoice {
        type Error = crate::errors::IssueInvoiceError;

        fn issue(&mut self) -> core::result::Result<(), Self::Error> {
            Ok(())
        }
    }
}

/// An error type that depends on selecting a trait implementation for a caller
/// supplied type parameter.
pub mod selection {
    use super::projection::Failing;

    pub struct Invoice;

    impl Invoice {
        pub fn issue<T: Failing>(&mut self, inner: &mut T) -> core::result::Result<(), T::Error> {
            inner.issue()
        }
    }
}

/// A return type that only the body establishes.
pub mod inference {
    pub struct Invoice;

    impl Invoice {
        pub fn issue(&mut self) -> impl core::fmt::Debug {
            0u8
        }
    }
}

/// A type argument that is still open at the declaration.
pub mod unbound {
    pub struct Invoice<T>(pub T);

    impl<T> Invoice<T> {
        pub fn issue(&self) -> core::result::Result<(), T> {
            loop {}
        }
    }
}
