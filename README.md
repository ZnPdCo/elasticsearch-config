# elasticsearch-config

这是 OI wiki 的搜索服务器后端，同时能够支持将 build 出来的静态页面发布。

`/home/ubuntu/OI-wiki` 是项目源文件储存的地方，用来更新索引；`/var/www/OI-wiki` 是 build 出来的静态文件，用于发布网站。

`webhook` 文件夹内的代码会监听 github 上的更新，然后事实更新上面两个文件夹内的仓库，同时更新索引。第一次启动 `webhook` 会清空之前的索引并新建一个。

`api` 文件夹内的代码是一个搜索服务器，会在 `localhost:8000` 下启动，api 为 `/?s=manach`。

部署需要有 es 环境并安装好 ik 与 pinyin 插件，并将 `/plugins/ik/config/stopword.dic` 与 `/plugins/ik/config/extra_stopword.dic` 内容清空（禁用停用词）：

```
npm install
git clone https://github.com/OI-wiki/OI-wiki.git /home/ubuntu/OI-wiki
cd /home/ubuntu/OI-wiki
git remote add gh https://github.com/OI-wiki/OI-wiki.git
git clone https://github.com/OI-wiki/OI-wiki.git /var/www/OI-wiki -b gh-pages
```

直接修改代码或创建环境变量 `GITHUB_PATH` 与 `GITHUB_SECRET` 表示 webhook 的地址与密钥。Github 上的 Content type 配置为 `application/json`。

同时也需要修改代码或创建环境变量 `SEARCH_SECRET` 表示搜索服务器的密钥，使用这个密钥可以获取 es 的状态。

初始化并启动 webhook：

```
npm run webhook
```

测试：

```
npm run test
```

启动 api 接口：

```
npm run serve
```

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

