#!/usr/bin/env bun
import { runArtifactSetCommand } from "./ddd/lib/artifact-set/index.ts";

// Usable on its own: no sensor registration and no approval stage stand between the team and this command.
const result = runArtifactSetCommand(process.argv.slice(2));
console.log(result.stdout);
process.exitCode = result.exitCode;
