var http = require('http')
var createHandler = require('github-webhook-handler')
var handler = createHandler({ path: '/MY_SECRET_PATH', secret: 'MY_SECRET_KEY' })
const elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: 'localhost:9200',
});


let remark = require('remark');
let strip = require('strip-markdown-math');
const math = require("remark-math");
remark = remark()
  .use(math)
  .use(strip);

const fs = require('fs');
let yml = '';
function getContent(e) {
  try {
    file = String(fs.readFileSync('/home/ubuntu/OI-wiki/' + e));
  } catch (e) {
    return ['', '', ''];
  }
  lines = file.split('\n');
  let h1reg = /^# .+$/gm, h2reg = /^## .+$/gm, authorreg = /author:[^\n]*/gm;
  others = lines.filter((e) => {return !e.match(h1reg) && !e.match(h2reg) && !e.match(authorreg));
  let title = lines[0];
  let filename = e.replace('docs/', '');
  if (!title.match(h1reg)) {
    if (!yml) yml = String(fs.readFileSync('/home/ubuntu/OI-wiki/mkdocs.yml')).split('\n');
    yml.forEach((cur) => {
      if (cur.indexOf(filename) > -1) {
        title = cur.split(':')[0].replace(/^\s+- /m, '');
      }
    });
  } else {
    title = title.replace('# ', '');
  }
  
  h2 = lines.filter((e) => {return e.match(h2reg)});
  remark.process(others.join('\n'), function(err, file) {
    if (err) throw err;
    //others = String(file);
    others = String(file)
      .replace('"', "")
      .replace("\\n\\n", "\\n");
  })
  return [title, others, h2];
}
http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404
    res.end('no such location')
  })
}).listen(3000)

handler.on('error', function (err) {
  console.error('Error:', err.message)
})

const { exec } = require('child_process');
handler.on('push', function (event) {
  console.log('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref)
  exec('bash update.sh', (err, stdout, stderr) => {
    if (err) {
      console.log('err ' + err);
      //res.statusCode = 404
      //res.end('shell failed');
      // node couldn't execute the command
      return;
    }

    // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
console.log(event.payload.ref);
    if (event.payload.ref.indexOf('refs/heads/master') == 0) {
    //let added = [], removed = [], modified = [];
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
    //added = [...new Set(added)]
    removed = [...removed]
    modified = [...modified]
    removed = removed.filter((e) => { return e.startsWith('docs') && e.endsWith('md')});
    modified = modified.filter((e) => { return e.startsWith('docs') && e.endsWith('md')});
    
    console.log(modified);
    console.log(removed);

    let ops = [];
    modified.forEach((e) => {
      ops.push({index: {_index: 'oiwiki', _type: 'article', _id: e} });
      let [title, article, h2] = getContent(e);
      ops.push({
        title: title,
        content: article,
        url: e.replace('docs','').replace('/index.md', '/').replace('.md', '/'),
        h2: h2,
      });
    });
    removed.forEach((e) => {
      ops.push({delete: { _index: 'oiwiki', _type: 'article', _id: e} });
    });
    client.bulk({body: ops, refresh: 'true'}, function(err, res) {
      if (err) {
        console.log('Failed Bulk opoeration', err);
        //res.statusCode = 504;
        //res.end('elasticsearch bulk op failed');
        return;
      }
      console.log('Elasticsearch bulk op success');
    });
    /*
    removed.forEach((e) => {
      let [title, article, h2] = getContent(e);
      client.index({
        index: 'oiwiki',
        id: e,
        body: {
          title: title,
          content: article,
          url: e.replace('docs','').replace('.md', '/')
        }
      }, (err, res) => {
        if (err) {
          res.statusCode = 504
          res.end('elasticsearch add index failed');
          return;
        }
      });
    });
    */
}
 });
})
