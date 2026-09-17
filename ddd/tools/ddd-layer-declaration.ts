#!/usr/bin/env bun
import { runLayerDeclarationCommand } from "./ddd/lib/layer-declaration/index.ts";

// Usable on its own: no sensor registration and no approval stage stand between the team and this command.
const result = runLayerDeclarationCommand(process.argv.slice(2));
console.log(result.stdout);
process.exitCode = result.exitCode;
