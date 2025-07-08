# 电影信息代理

此代理使用TMDB API来回答有关电影的问题。运行方法：

```bash
export TMDB_API_KEY=<api_key> # 参见 https://developer.themoviedb.org/docs/getting-started
export GEMINI_API_KEY=<api_key>
npm run agents:movie-agent
```

代理将在 `http://localhost:41241` 上启动。
