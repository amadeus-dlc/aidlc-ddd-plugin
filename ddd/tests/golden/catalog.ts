import { CONTRACT_CASES } from "./contract/cases.ts";
import { DESIGN_CASES } from "./design/cases.ts";
import { MODULE_LAYOUT_CASES } from "./module-layout/cases.ts";
import { PACKAGING_CASES } from "./packaging/cases.ts";
import { RUST_CASES } from "./rust/cases.ts";
export const ALL_CASES = [
  ...DESIGN_CASES,
  ...RUST_CASES,
  ...PACKAGING_CASES,
  ...CONTRACT_CASES,
  ...MODULE_LAYOUT_CASES,
];
