/**
 * TMDB 搜索工具定义模块
 *
 * 此模块定义了用于搜索电影和人物信息的 Genkit 工具。
 * 这些工具可以被 AI 模型调用，以获取 TMDB 数据库中的娱乐内容信息。
 *
 * 包含的工具：
 * - searchMovies：搜索电影信息
 * - searchPeople：搜索人物信息
 *
 * 工具特性：
 * - 自动格式化输出，便于 AI 理解和处理
 * - 完整的错误处理
 * - 支持图片 URL 的完整路径转换
 * - 提供结构化的数据返回
 *
 * 数据来源：The Movie Database (TMDB) API
 * 使用前需要设置环境变量：TMDB_API_KEY
 */

import { ai, z } from './genkit';
import { callTmdbApi } from './tmdb';

/**
 * TMDB API 响应的通用结构
 * @template T 结果数据的类型
 */
interface Response<T> {
  page: number; // 当前页码
  results: T[]; // 搜索结果数组
  total_pages: number; // 总页数
  total_results: number; // 总结果数
}

/**
 * 电影搜索结果的数据结构
 * 包含电影的基本信息和元数据
 */
interface MovieResult {
  adult: boolean; // 是否为成人内容
  backdrop_path: string; // 背景图片路径
  genre_ids: number[]; // 类型ID数组
  id: number; // 电影ID
  original_language: string; // 原始语言
  original_title: string; // 原始标题
  overview: string; // 电影简介
  popularity: number; // 热度分数
  poster_path: string; // 海报图片路径
  release_date: string; // 发行日期
  title: string; // 电影标题
  video: boolean; // 是否为视频
  vote_average: number; // 平均评分
  vote_count: number; // 评分人数
}

/**
 * 人物搜索结果的数据结构
 * 包含人物的基本信息和代表作品
 */
interface PersonResult {
  adult: boolean; // 是否为成人内容
  gender: number; // 性别（1=女性，2=男性）
  id: number; // 人物ID
  known_for: {
    // 代表作品数组
    adult: boolean;
    backdrop_path: string;
    genre_ids: number[];
    id: number;
    media_type: string; // 媒体类型（movie/tv）
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    release_date: string;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
  }[];
  known_for_department: string; // 主要工作领域
  name: string; // 姓名
  original_name: string; // 原始姓名
  popularity: number; // 热度分数
  profile_path: string; // 头像图片路径
}

/**
 * 电影搜索工具
 *
 * 此工具允许 AI 模型在 TMDB 数据库中搜索电影信息。
 * 它会返回格式化的电影数据，包括标题、简介、评分等信息。
 *
 * 功能特点：
 * - 自动将相对路径转换为完整的图片 URL
 * - 返回结构化的文本描述，便于 AI 理解
 * - 包含详细的电影元数据
 * - 支持中文搜索查询
 */
export const searchMovies = ai.defineTool(
  {
    name: 'searchMovies',
    description: '按标题在TMDB中搜索电影',
    inputSchema: z.object({
      query: z.string().describe('要搜索的电影标题或关键词'),
    }),
  },
  async ({ query }) => {
    console.log();
    console.log('正在调用[tmdb:searchMovies]，参数：', JSON.stringify(query));
    console.log();
    try {
      // 调用 TMDB API 搜索电影
      const data = await callTmdbApi<Response<MovieResult>>('movie', query);

      // 处理搜索结果，转换图片路径为完整URL
      const results = data.results.map((movie: MovieResult) => {
        if (movie.poster_path) {
          movie.poster_path = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        }
        if (movie.backdrop_path) {
          movie.backdrop_path = `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`;
        }
        return movie;
      });

      // 格式化返回内容，便于 AI 理解和处理
      const content = `以下是搜索到的电影信息，请根据这些信息为用户提供详细的回答：

${results
  .map(
    (movie, index) =>
      `${index + 1}. 《${movie.title}》
   - 简介：${movie.overview}
   - 上映日期：${movie.release_date}
   - 评分：${movie.vote_average}/10
   - 受欢迎程度：${movie.popularity}
   - 海报链接：${movie.poster_path}`
  )
  .join('\n\n')}

请根据以上信息为用户提供有用的电影推荐或答案。`;

      return content;
    } catch (error) {
      console.error('搜索电影时出错:', error);
      throw error; // 重新抛出错误让 Genkit 处理
    }
  }
);

/**
 * 人物搜索工具
 *
 * 此工具允许 AI 模型在 TMDB 数据库中搜索人物信息。
 * 它会返回格式化的人物数据，包括姓名、职业、代表作品等信息。
 *
 * 功能特点：
 * - 自动将相对路径转换为完整的图片 URL
 * - 返回结构化的文本描述，便于 AI 理解
 * - 包含人物的代表作品信息
 * - 支持中文搜索查询
 */
export const searchPeople = ai.defineTool(
  {
    name: 'searchPeople',
    description: '按姓名在TMDB中搜索人物',
    inputSchema: z.object({
      query: z.string().describe('要搜索的人物姓名或关键词'),
    }),
  },
  async ({ query }) => {
    console.log(
      '\n正在调用[tmdb:searchPeople]，参数：',
      JSON.stringify(query),
      '\n'
    );
    try {
      // 调用 TMDB API 搜索人物
      const data = await callTmdbApi<Response<PersonResult>>('person', query);

      // 处理搜索结果，转换图片路径为完整URL
      const results = data.results.map((person: any) => {
        if (person.profile_path) {
          person.profile_path = `https://image.tmdb.org/t/p/w500${person.profile_path}`;
        }

        // 同时处理代表作品中的图片路径
        if (person.known_for && Array.isArray(person.known_for)) {
          person.known_for = person.known_for.map((work: any) => {
            if (work.poster_path) {
              work.poster_path = `https://image.tmdb.org/t/p/w500${work.poster_path}`;
            }
            if (work.backdrop_path) {
              work.backdrop_path = `https://image.tmdb.org/t/p/w500${work.backdrop_path}`;
            }
            return work;
          });
        }

        return person;
      });

      // 格式化返回内容，便于 AI 理解和处理
      const content = `以下是搜索到的人物信息，请根据这些信息为用户提供详细的回答：

${results
  .map(
    (person, index) =>
      `${index + 1}. ${person.name} (${person.original_name})
   - 主要职业：${person.known_for_department}
   - 受欢迎程度：${person.popularity}
   - 头像链接：${person.profile_path || '暂无'}
   - 代表作品：
${
  person.known_for && person.known_for.length > 0
    ? person.known_for
        .map(
          (work, workIndex) =>
            `     ${workIndex + 1}. 《${work.title}》${
              work.original_title ? ` (${work.original_title})` : ''
            }
        - 类型：${
          work.media_type === 'movie'
            ? '电影'
            : work.media_type === 'tv'
            ? '电视剧'
            : '其他'
        }
        - 上映日期：${work.release_date || '未知'}
        - 评分：${work.vote_average}/10
        - 简介：${
          work.overview ? work.overview.substring(0, 100) + '...' : '暂无简介'
        }`
        )
        .join('\n')
    : '     暂无代表作品信息'
}
   - 人物ID：${person.id}`
  )
  .join('\n\n')}

请根据以上信息为用户提供有用的人物介绍或答案。`;

      return content;
    } catch (error) {
      console.error('搜索人物时出错:', error);
      throw error; // 重新抛出错误让 Genkit 处理
    }
  }
);
