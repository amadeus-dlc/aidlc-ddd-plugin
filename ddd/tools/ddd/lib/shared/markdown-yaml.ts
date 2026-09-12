/** Read one labelled YAML block, optionally inside one exact H2 section. */
export function readYamlBlock(markdown: string, heading?: string): { yaml: string; startLine: number } {
  const lines = markdown.split(/\r?\n/);
  const blocks: { yaml: string; startLine: number }[] = [];
  let selected = heading === undefined;
  let sections = 0;
  let fence: { marker: string; length: number; yaml: boolean; start: number; body: string[] } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence.marker && close[1].length >= fence.length) {
        if (fence.yaml && selected) blocks.push({ yaml: fence.body.join("\n"), startLine: fence.start + 2 });
        fence = undefined;
      } else {
        fence.body.push(line);
      }
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line);
    if (open) {
      fence = {
        marker: open[1][0],
        length: open[1].length,
        yaml: /^(yaml|yml)$/.test(open[2].trim()),
        start: i,
        body: [],
      };
      continue;
    }
    if (heading !== undefined && /^#{1,2} /.test(line)) {
      selected = line.trimEnd() === `## ${heading}`;
      if (selected) sections++;
    }
  }
  if (heading !== undefined && sections !== 1) throw new Error(`exactly one '## ${heading}' section is required`);
  if (fence?.yaml && selected) throw new Error("the YAML block is not closed");
  if (blocks.length !== 1) throw new Error("exactly one labelled YAML block is required");
  return blocks[0];
}
