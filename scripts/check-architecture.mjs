import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : [`${dir}/${entry.name}`],
    );
const files = ['app', 'features', 'shared', 'shell']
  .flatMap(walk)
  .filter((file) => /\.tsx?$/.test(file));
const graph = new Map();
const errors = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const dependencies = [];
  for (const spec of imports) {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
    const base = spec.startsWith('@/')
      ? spec.slice(2)
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    if (base.endsWith('.css')) continue;
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(
      (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
    );
    if (!target) {
      errors.push(`${file}: unresolved ${spec}`);
      continue;
    }
    dependencies.push(target);
    if (file.startsWith('shared/') && !target.startsWith('shared/'))
      errors.push(`${file}: shared depends on ${target}`);
    if (
      file.startsWith('features/') &&
      (target.startsWith('shell/') ||
        target.startsWith('app/') ||
        (target.startsWith('features/') &&
          file.split('/')[1] !== target.split('/')[1]))
    )
      errors.push(`${file}: feature boundary crossed by ${target}`);
    if (
      file.startsWith('shell/') &&
      (target.includes('/server/') || target.startsWith('app/'))
    )
      errors.push(`${file}: shell imports server/route ${target}`);
  }
  graph.set(file, {
    dependencies,
    client: /^['"]use client['"];/.test(source),
  });
}
for (const [entry, value] of graph)
  if (value.client) {
    const seen = new Set();
    const visit = (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (file.includes('/server/'))
        errors.push(`${entry}: client reaches ${file}`);
      for (const target of graph.get(file)?.dependencies ?? []) visit(target);
    };
    visit(entry);
  }
if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else console.log(`Architecture boundaries passed (${files.length} modules).`);
