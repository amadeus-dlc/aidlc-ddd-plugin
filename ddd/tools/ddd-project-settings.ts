#!/usr/bin/env bun
import { runProjectSettingsCommand } from "./ddd/lib/project-settings/index.ts";

// Usable on its own: no sensor registration and no approval stage stand between the team and this command.
const result = runProjectSettingsCommand(process.argv.slice(2));
console.log(result.stdout);
process.exitCode = result.exitCode;
