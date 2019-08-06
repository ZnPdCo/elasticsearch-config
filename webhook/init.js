const fs = require("fs");
let remark = require("remark");
const strip = require("strip-markdown-math");
const math = require("remark-math");
remark = remark()
  .use(math)
  .use(strip);

const elasticsearch = require("elasticsearch");
var client = new elasticsearch.Client({
  host: "localhost:9200",
  log: "trace"
});

// modified = String(fs.readFileSync('/home/ubuntu/OI-wiki/mkdocs.yml')).split('\n').filter((e => {return e.match(/md$/)})).map(e =>'docs/' + e.split(':')[1].slice(1));
modified = String(fs.readFileSync('/home/ubuntu/OI-wiki/mkdocs.yml')).split('\n').slice(100, 300).filter((e => {return e.match(/md$/)})).map(e =>'docs/' + e.split(':')[1].slice(1));

let ops = [],
  yml = "";
function getContent(e) {
  try {
    file = String(fs.readFileSync("/home/ubuntu/OI-wiki/" + e));
  } catch (e) {
    return ["", "", ""];
  }
  lines = file.split("\n");
  let h1reg = /^# .+$/gm,
    h2reg = /^## .+$/gm,
    authorreg = /author:[^\n]*/gm;
  lines = lines.filter((e) => {return !e.match(authorreg));
  others = lines.filter(e => {
    return !e.match(h1reg) && !e.match(h2reg);
  });
  let title = lines[0];
  let filename = e.replace("docs/", "");
  if (!title.match(h1reg)) {
    if (!yml)
      yml = String(fs.readFileSync("/home/ubuntu/OI-wiki/mkdocs.yml")).split(
        "\n"
      );
    yml.forEach(cur => {
      if (cur.indexOf(filename) > -1) {
        title = cur.split(":")[0].replace(/^\s+- /m, "");
      }
    });
  } else {
    title = title.replace("# ", "");
  }

  h2 = lines.filter(e => {
    return e.match(h2reg);
  });
  remark.process(others.join("\n"), function(err, file) {
    if (err) throw err;
   // others = String(file);
      others = String(file)
      .replace('"', "")
      .replace("\\n\\n", "\\n");
  });
  return [title, others, h2];
}
modified.forEach(e => {
  ops.push({ index: { _index: "oiwiki", _type: "article", _id: e } });
  let [title, article, h2] = getContent(e);
  ops.push({
    title: title,
    content: article,
    url: e.replace('docs','').replace('/index.md', '/').replace('.md', '/'),
    h2: h2
  });
});
let removed = [];
removed.forEach(e => {
  ops.push({ delete: { _index: "oiwiki", _type: "article", _id: e } });
});
client.bulk({ body: ops, refresh: "true" }, function(err, res) {
  if (err) {
    console.log("Failed Bulk opoeration", err);
    res.statusCode = 504;
    res.end("elasticsearch bulk op failed");
    return;
  }
  console.log("Elasticsearch bulk op success");
});

