import { readFile } from 'node:fs/promises';
import path from 'node:path';
import LegacyRenderer from './legacy-renderer';

const fontStylesheet = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap';

export default async function LegacyPage({ fileName, styles, scripts }) {
  const filePath = path.join(process.cwd(), fileName);
  const html = await readFile(filePath, 'utf8');
  const body = html.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i);

  if (!body) {
    throw new Error(`Could not find a body element in ${fileName}.`);
  }

  const bodyClass = body[1].match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
  const content = body[2].replace(/<script\b(?=[^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');

  return (
    <LegacyRenderer
      bodyClass={bodyClass}
      content={content}
      styles={['/css/style.css', ...styles]}
      scripts={scripts}
      fontStylesheet={fontStylesheet}
    />
  );
}
