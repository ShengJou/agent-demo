/**
 * 调用 TMDB API 的工具函数
 * @param endpoint TMDB API 端点（例如，'movie', 'person'）
 * @param query 搜索查询
 * @returns 解析为 API 响应数据的 Promise
 */

export async function callTmdbApi<T extends any>(
  endpoint: string,
  query: string
): Promise<T> {
  // 验证 API 密钥
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB_API_KEY环境变量未设置");
  }

  try {
    // 动态导入 fetch
    const { default: fetch } = await import("node-fetch");

    // 向 TMDB API 发起请求
    const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("query", query);
    url.searchParams.append("include_adult", "false");
    url.searchParams.append("language", "en-US");
    url.searchParams.append("page", "1");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `TMDB API error: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error calling TMDB API (${endpoint}):`, error);
    throw error;
  }
}
