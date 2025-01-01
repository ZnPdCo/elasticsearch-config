const elasticsearch = require("elasticsearch");
var client = new elasticsearch.Client({
  host: "localhost:9200",
  log: "trace"
});
let keyword = "线段";
const response = client.search({
  index: "oiwiki",
  from: 0,
  size: 10,
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
          },
          {
            match: {
              standard_content: {
                query: keyword,
                minimum_should_match: "75%",
                boost: 2
              }
            }
          }
        ],
        tie_breaker: 0.3
      }
    },
    highlight: {
      pre_tags: ["<b>"],
      post_tags: ["</b>"],
      fields: {
        title: {},
        content: {}
      }
    }
  }
});

