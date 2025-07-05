/**
 * TMDB API 调用工具模块
 *
 * 此模块提供了与 The Movie Database (TMDB) API 交互的工具函数。
 * TMDB 是一个开源的电影和电视节目数据库，提供了丰富的娱乐内容信息。
 *
 * 主要功能：
 * - 搜索电影信息
 * - 搜索人物信息
 * - 处理 API 请求和响应
 * - 错误处理和日志记录
 *
 * 使用前需要：
 * 1. 在 TMDB 官网注册账户：https://www.themoviedb.org/
 * 2. 获取 API 密钥
 * 3. 设置环境变量 TMDB_API_KEY
 *
 * API 文档：https://developers.themoviedb.org/3/
 */

/**
 * 调用 TMDB API 的通用工具函数
 *
 * 此函数封装了 TMDB API 的通用调用逻辑，包括：
 * - API 密钥验证
 * - URL 构建和参数配置
 * - HTTP 请求发送
 * - 响应处理和错误处理
 *
 * @template T 期望的返回数据类型
 * @param endpoint TMDB API 端点（例如 'movie', 'person', 'tv'）
 * @param query 搜索查询字符串
 * @returns 解析为指定类型的 API 响应数据的 Promise
 *
 * @throws {Error} 当 API 密钥未设置时抛出错误
 * @throws {Error} 当 API 请求失败时抛出错误
 *
 * @example
 * ```typescript
 * // 搜索电影
 * const movieData = await callTmdbApi<MovieResponse>('movie', '泰坦尼克号');
 *
 * // 搜索人物
 * const personData = await callTmdbApi<PersonResponse>('person', '成龙');
 * ```
 */
export async function callTmdbApi<T extends any>(
  endpoint: string,
  query: string
): Promise<T> {
  // 验证 API 密钥是否已设置
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB_API_KEY环境变量未设置");
  }

  try {
    // 动态导入 fetch 以支持 Node.js 环境
    const { default: fetch } = await import("node-fetch");

    // 构建 TMDB API 请求 URL
    const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    url.searchParams.append("api_key", apiKey); // API 密钥
    url.searchParams.append("query", query); // 搜索查询
    url.searchParams.append("include_adult", "false"); // 排除成人内容
    url.searchParams.append("language", "en-US"); // 语言设置
    url.searchParams.append("page", "1"); // 页码（默认第一页）

    // 发送 HTTP 请求
    const response = await fetch(url.toString());

    // 检查响应状态
    if (!response.ok) {
      throw new Error(
        `TMDB API error: ${response.status} ${response.statusText}`
      );
    }

    // 解析并返回 JSON 响应
    return (await response.json()) as T;
  } catch (error) {
    // 记录错误并重新抛出
    console.error(`Error calling TMDB API (${endpoint}):`, error);
    throw error;
  }
}
