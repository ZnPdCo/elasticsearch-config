# elasticsearch-config

统计：

```
curl -H'Content-Type: application/json' -XGET http://localhost:PORT/oiwiki/_count
```

清空

```
curl -H'Content-Type: application/json' -XPOST "http://localhost:PORT/oiwiki/_delete_by_query" -d'
{
     "query":{
          "match_all":{}
      }
}'

```

