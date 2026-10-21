import ts from 'typescript';

/** A line that must keep a literal (stored data, a brand) carries this marker, with a reason. */
export const IGNORE_MARKER = 'i18n-ignore';

/** Props and object keys that carry text a person reads or hears. */
const TEXT_KEYS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'aria-label',
  'label',
  'loadingLabel',
  'title',
  'subtitle',
  'message',
  'placeholder',
  'actionLabel',
  'secondaryActionLabel',
  'scanLabel',
  'biometricLabel',
  'value',
  'detail',
  'meta',
  'body',
  'hint',
  'lead',
  'promptMessage',
  'cancelLabel',
  'fallbackLabel',
  'text',
]);

/** Reads like words for a person: a capitalised word, or several words. */
function isProse(text: string): boolean {
  const value = text.trim();
  if (!/\p{L}{2}/u.test(value)) return false;
  return /^\p{Lu}\p{Ll}/u.test(value) || /\p{L}{2,}\s+\p{L}{2,}/u.test(value);
}

/** A sentence anywhere else: a capitalised word followed by more words. */
function isSentence(text: string): boolean {
  return /^\p{Lu}[\p{Ll}’']*(?:\s+\S+)+/u.test(text.trim());
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return null;
}

const EXEMPT_CALLEE = /^(Error|TypeError|RangeError)$|^console\.|^jest\.|^require$/;

/** A literal that can't reach a person: errors, logs, imports, types, object keys. */
function isExempt(node: ts.Node): boolean {
  for (let current: ts.Node = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isTypeNode(parent)) return true;
    if (ts.isPropertyAssignment(parent) && parent.name === current) return true;
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === current) return true;
    if (
      (ts.isNewExpression(parent) || ts.isCallExpression(parent)) &&
      EXEMPT_CALLEE.test(parent.expression.getText())
    ) {
      return true;
    }
    if (ts.isBlock(parent) || ts.isSourceFile(parent)) return false;
  }
  return false;
}

function passesThrough(node: ts.Node): boolean {
  return (
    ts.isConditionalExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    (ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.PlusToken,
      ].includes(node.operatorToken.kind))
  );
}

/** Where a value ends up, through ternaries, `??`, `&&` and `+`: a text key, JSX children, or neither. */
function destination(node: ts.Node): { key: string | null; jsxChild: boolean } {
  let current: ts.Node = node;
  while (current.parent) {
    const parent: ts.Node = current.parent;
    if (passesThrough(parent)) {
      current = parent;
      continue;
    }
    if (ts.isJsxExpression(parent)) {
      if (ts.isJsxAttribute(parent.parent)) {
        return { key: parent.parent.name.getText(), jsxChild: false };
      }
      return { key: null, jsxChild: true };
    }
    if (ts.isJsxAttribute(parent)) return { key: parent.name.getText(), jsxChild: false };
    if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
      return { key: parent.name.getText().replace(/['"`]/g, ''), jsxChild: false };
    }
    return { key: null, jsxChild: false };
  }
  return { key: null, jsxChild: false };
}

/**
 * Lists the user-facing literals in a source file: JSX text (one line or
 * many, alone or around `{name}`), literals inside JSX children (`{'…'}`,
 * ternaries), text props and object keys (`label=`, `{ message: … }`), and
 * any other literal that reads as a sentence, which covers `.ts` copy
 * modules. Errors, logs, imports, types and keys are exempt, and a line
 * marked `i18n-ignore` keeps its literal.
 */
export function findHardcodedStrings(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines = source.split('\n');
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line;
    if (lines[line]?.includes(IGNORE_MARKER) || lines[line - 1]?.includes(IGNORE_MARKER)) return;
    found.push(`${fileName}:${line + 1}: ${JSON.stringify(text.trim().slice(0, 60))}`);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (/\p{L}/u.test(node.text)) report(node, node.text);
      return;
    }
    const text = literalText(node);
    if (text !== null && !isExempt(node)) {
      const { key, jsxChild } = destination(node);
      const prose = isProse(text);
      if (
        (key !== null && TEXT_KEYS.has(key) && prose) ||
        (jsxChild && prose) ||
        isSentence(text)
      ) {
        report(node, text);
      }
      if (!ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
