const http = require('http');
const YAML = require('yaml');
const createHandler = require('github-webhook-handler');
const simpleGit = require('simple-git');
const elasticsearch = require('elasticsearch');
const fs = require('fs');
const path = require('path');
const remarkLib = require('remark');
const math = require('remark-math');
const strip = require('strip-markdown-math');


// const REPO_DIR = '/home/ubuntu/OI-wiki';
const REPO_DIR = '/OI-wiki';
const WEB_DIR = '/var/www/OI-wiki';
const GITHUB_PATH = process.env.GITHUB_PATH || '/events';
const GITHUB_SECRET = process.env.GITHUB_SECRET || 'asdlkfijawefojaewiofj';

const gitRepo = simpleGit({ baseDir: REPO_DIR });
const gitWeb = simpleGit({ baseDir: WEB_DIR });

var client = new elasticsearch.Client({
  host: 'localhost:9200',
});

const remark = remarkLib()
  .use(math)
  .use(strip);

/**
 * Traversal all articles.
 *
 * @param data     - Data of files
 * @param callback - Call function(key, value)
 */
function traversalArticle(data, callback) {
  if (!Array.isArray(data) && (typeof data !== 'object' || data === null)) return;

  for (const item of (Array.isArray(data) ? data : Object.values(data))) {
    if (typeof item === 'string') {
      callback(Object.keys(data).find(key => data[key] === item), item);
    }
    traversalArticle(item, callback);
  }
  return;
}

/**
 * Get article's content by filename.
 *
 * @param filename - Filename likes 'tools/editor/atom.md'
 * @param data     - Data of mkdocs.yml
 */
function getContent(filename, data) {
  let file;
  try {
    file = String(fs.readFileSync(`/OI-wiki/docs/` + filename));
  } catch (e) {
    console.error(`Error reading file ${filename}:`, e);
    return ['', '', '', ''];
  }

  const h1reg = /^# .+$/gm, h2reg = /^## .+$/gm, authorreg = /author:[^\n]*/gm, boldreg = /\*\*(.*?)\*\*|__(.*?)__/g;
  const lines = file.split('\n').filter(e => !e.match(authorreg));
  let content = lines.filter((e) => !e.match(h1reg) && !e.match(h2reg));
  let title = lines[0] && lines[0].match(h1reg) ?
    lines[0].replace('# ', '') : '';
  traversalArticle(data['nav'], (key, value) => {
    if (value == filename) title = key;
  });
  const h2 = lines.filter(e => e.match(h2reg)).map(e => e.replace(/^## /, ''));

  let bold = [];
  let match;
  while ((match = boldreg.exec(file)) !== null) {
    // match[1] is the content in **bold**, match[2] is the content in __bold__
    bold.push(match[1] || match[2]);
  }

  content = content.map(e => e.replace(/^##+ /, ''));

  remark.process(content.join('\n'), (err, file) => {
    if (err) {
      console.error('Remark processing error:', err);
      return;
    }
    content = String(file)
      .replace('"', "")
      .replace("\\n\\n", "\\n");
  });

  content.replace()

  return [title, content, h2.join('\n'), bold.join('\n')];
}

/**
 * update articles' content to ES.
 *
 * @param modified - Array of added/modified files
 * @param removed - Array of removed files
 */
async function updateContent(modified, removed) {
  const file = String(fs.readFileSync(path.join(REPO_DIR, 'mkdocs.yml')));
  const data = YAML.parse(file.replaceAll('!!python/name:', ''));
  let ops = [];
  modified.forEach((filename) => {
    let [title, article, h2, bold] = getContent(filename, data);
    if (title != '') {
      ops.push({ index: { _index: 'oiwiki', _id: filename } });
      ops.push({
        title: title,
        content: article,
        url: '/' + filename.replace('/index.md', '/').replace('.md', '/'),
        h2: h2,
        bold: bold,
        standard_content: article,
      });
    }
  });
  removed.forEach((filename) => {
    ops.push({ delete: { _index: 'oiwiki', _id: filename } });
  });
  const res = await client.bulk({ body: ops, refresh: 'true' });
  if (res.errors) {
    console.error('Bulk operation had errors:', res);
  } else {
    console.log('Bulk operation succeeded.');
  }
}

const handler = createHandler({ path: GITHUB_PATH, secret: GITHUB_SECRET });

http.createServer((req, res) => {
  handler(req, res, (err) => {
    res.statusCode = 404;
    res.end('request unsuccessful');
    console.error('Verified error:', err);
  });
}).listen(3000);

handler.on('error', (err) => {
  console.error('Handler error:', err.message);
});

handler.on('push', async (event) => {
  if (event.payload.ref !== 'refs/heads/master') return;

  console.debug('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref);

  await gitWeb.fetch('origin', 'gh-pages');
  await gitWeb.reset(['origin/gh-pages', '--hard']);
  console.log('update website');

  await gitRepo.fetch('gh', 'master');
  await gitRepo.reset(['gh/master', '--hard']);
  console.log('update repo');

  let removed = new Set([]), modified = new Set([]);
  event.payload.commits.forEach((e) => {
    e.added.forEach(w => {
      modified.add(w);
      removed.delete(w);
    });
    e.modified.forEach(w => modified.add(w));
    e.removed.forEach(w => {
      removed.add(w);
      modified.delete(w);
    });
  });

  removed = [...removed].filter(e => e.startsWith('docs') && e.endsWith('md'));
  modified = [...modified].filter(e => e.startsWith('docs') && e.endsWith('md'));

  removed.forEach((file, index) => removed[index] = file.replace('docs/', ''));
  modified.forEach((file, index) => modified[index] = file.replace('docs/', ''));

  await updateContent(modified, removed);
  console.log('index update');
});

/**
 * recreate index (delete if exists, then create)
 */
async function recreateIndex() {
  const exists = await client.indices.exists({ index: 'oiwiki' });
  if (exists) {
    await client.indices.delete({ index: 'oiwiki' });
    console.log('Deleted existing index');
  }

  const body = {
    settings: {
      analysis: {
        analyzer: {
          pinyin_analyzer: {
            type: 'custom',
            tokenizer: 'ik_max_word',
            filter: ['pinyin_filter']
          }
        },
        filter: {
          pinyin_filter: {
            type: 'pinyin',
            keep_separate_first_letter: true,
            keep_full_pinyin: true,
            keep_original: true,
            first_letter: 'prefix',
            limit_first_letter_length: 16,
            lowercase: true,
            remove_duplicated_term: true
          }
        }
      }
    },
    mappings: {
      properties: {
        content: { type: 'text', analyzer: 'pinyin_analyzer' },
        h2: { type: 'text', analyzer: 'pinyin_analyzer' },
        title: { type: 'text', analyzer: 'pinyin_analyzer' },
        url: { type: 'text' },
        bold: { type: 'text', analyzer: 'pinyin_analyzer' },
        standard_content: { type: 'text', analyzer: 'simple' }
      }
    }
  };

  await client.indices.create({ index: 'oiwiki', body });
  console.log('Created index');
}

async function init() {
  await recreateIndex();
  const file = String(fs.readFileSync(path.join(REPO_DIR, 'mkdocs.yml')));
  const data = YAML.parse(file.replaceAll('!!python/name:', ''));
  let modified = [];
  traversalArticle(data['nav'], (key, value) => modified.push(value));
  await updateContent(modified, []);
}

init();
