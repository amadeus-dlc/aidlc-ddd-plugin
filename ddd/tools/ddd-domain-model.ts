#!/usr/bin/env bun
import { runDomainModelCommand } from "./ddd/lib/domain-model/index.ts";

// Usable on its own: no sensor registration and no approval stage stand between the team and this command.
const result = runDomainModelCommand(process.argv.slice(2));
console.log(result.stdout);
process.exitCode = result.exitCode;
