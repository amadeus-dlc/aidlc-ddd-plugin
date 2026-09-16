#!/usr/bin/env bun
import { runAggregateMappingCommand } from "./ddd/lib/aggregate-mapping/index.ts";

// Usable on its own: no sensor registration and no approval stage stand between the team and this command.
const result = runAggregateMappingCommand(process.argv.slice(2));
console.log(result.stdout);
process.exitCode = result.exitCode;
