const elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: 'localhost:9200',
});
const express = require('express');
const app     = express();

function count(str) {
  const regex = /<em>(.*?)<\/em>/g;
  let len = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    len += match[1].length;
  }

  return len;
}

app.set('port', process.env.PORT || 8000);

app.get('/status', function(req, res) {
  if (req.query.s == MY_SECRET_KEY) {
    client.ping({
      requestTimeout: 1000,
    }, function (error) {
      if (error) {
        console.error('elasticsearch cluster is down!');
        res.end('elasticsearch cluster is down!');
      } else {
        console.log('All is well');
        res.end('All is well');
      }
    });
  }
});

app.get('/', function(req, res) {
  // if (!req.headers.referer || req.headers.referer.indexOf('oi-wiki.org') < 0) {
  //  res.send([]);
    //return;
  //}
  // console.log(req.headers);
  if (!req.query.s) {
    res.send([]);
    return;
  }
  let keyword = req.query.s.slice(0, 50);
  console.log(keyword);
  client.search({
    index: "oiwiki",
    type: "article",
    from: 0,
    size: 12,
    body: {
      query: {
        dis_max: {
          queries: [
            {
              match: {
                title: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 4
                }
              }
            },
            {
              match: {
                h2: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 3
                }
              }
            },
            {
              match: {
                content: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 2
                }
              }
            },
            {
              match: {
                url: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 3
                }
              }
            }
          ],
          tie_breaker: 0.3
        }
      },
      highlight: {
        pre_tags: ["<em>"],
        post_tags: ["</em>"],
        fields: {
          title: { number_of_fragments: 1 },
          h2: { number_of_fragments: 1 },
          content: { number_of_fragments: 1 },
          url: { number_of_fragments: 1 }
        },
        fragment_size: 20,
      }
    }
  })
  .then(results => {
    results = results.hits.hits;
    results = results.map((e) => {
      let highlight = [];
	  if (!e.highlight || (!e.highlight.content && !e.highlight.h2)) {
		highlight = [e._source.content.substring(0, 30)];
	  } else if (e.highlight.content && e.highlight.h2) {
		const contentCount = count(e.highlight.content[0]);
		const h2Count = count(e.highlight.h2[0]);
		
		highlight = (contentCount >= h2Count) ? e.highlight.content : e.highlight.h2;
	  } else {
		highlight = e.highlight.content || e.highlight.h2;
	  }
      return {
        url: e._source.url,
        title: e._source.title,
        highlight: highlight
      }
    });
    res.send(results);
  })
  .catch(err=> {
    console.log(err);
    res.send([]);
  });
});

app.listen(app.get('port'), function() {
  console.log('Search server running on port ' + app.get('port'));
});

