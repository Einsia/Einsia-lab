import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';

Prism.manual = true;

export type RecordLanguage = 'python' | 'markdown' | 'bash' | 'json' | 'plain';
const aliases: Record<string, RecordLanguage> = {
  py: 'python', python: 'python', md: 'markdown', markdown: 'markdown',
  sh: 'bash', bash: 'bash', shell: 'bash', json: 'json', txt: 'plain', text: 'plain',
};

export function languageForFile(name: string, fallback: RecordLanguage = 'plain'): RecordLanguage {
  return aliases[name.split('.').pop()!.toLowerCase()] ?? fallback;
}

function tokenize(text: string, language: RecordLanguage): Prism.TokenStream {
  if (language === 'plain') return text;
  const grammar = Prism.languages[language];
  const env = { code: text, grammar, language, tokens: Prism.tokenize(text, grammar) };
  // Markdown's hook identifies the languages of fenced code blocks.
  Prism.hooks.run('after-tokenize', env);
  return env.tokens;
}

function appendTokens(parent: Node, tokens: Prism.TokenStream): void {
  if (typeof tokens === 'string') {
    parent.appendChild(document.createTextNode(tokens));
  } else if (Array.isArray(tokens)) {
    tokens.forEach(token => appendTokens(parent, token));
  } else {
    const span = document.createElement('span');
    const classes = [tokens.type, ...[tokens.alias ?? []].flat()];
    span.classList.add('token', ...classes);
    const embedded = classes.find(name => name.startsWith('language-'))?.slice(9);
    const language = embedded ? aliases[embedded] : undefined;
    const content = tokens.type === 'code-block' && typeof tokens.content === 'string' && language
      ? tokenize(tokens.content, language) : tokens.content;
    appendTokens(span, content);
    parent.appendChild(span);
  }
}

export function highlightRecord(container: HTMLElement, text: string, language: RecordLanguage = 'plain'): void {
  const code = document.createElement('code');
  code.className = 'record-code';
  code.dataset.language = language;
  // Recorded source is always text nodes, including HTML-looking strings.
  // This also preserves exact whitespace instead of serializing through HTML.
  appendTokens(code, tokenize(text, language));
  container.replaceChildren(code);
}
