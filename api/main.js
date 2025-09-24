const elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: 'localhost:9200',
});
const express = require('express');
const app     = express();

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
  if (!req.query.s) {
    res.send([]);
    return;
  }
  let keyword = req.query.s.slice(0, 50);
  console.log(keyword);
  client.search({
    index: "oiwiki",
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
                  boost: 3
                }
              }
            },
            {
              match: {
                h2: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 2
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
            },
            {
              match: {
                bold: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 2
                }
              }
            },
            {
              match: {
                standard_content: {
                  query: keyword,
                  minimum_should_match: "75%",
                  boost: 4
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
      if (!e.highlight || !e.highlight.content) {
        highlight = [e._source.content.substring(0, 50)];
      } else {
        highlight = e.highlight.content;
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

