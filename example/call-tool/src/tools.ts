import { ai, z } from './genkit';
import { callTmdbApi } from './tmdb';

interface Response<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface MovieResult {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
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
}

interface PersonResult {
  adult: boolean;
  gender: number;
  id: number;
  known_for: {
    adult: boolean;
    backdrop_path: string;
    genre_ids: number[];
    id: number;
    media_type: string;
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
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string;
}

export const searchMovies = ai.defineTool(
  {
    name: 'searchMovies',
    description: '按标题在TMDB中搜索电影',
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log();
    console.log('正在调用[tmdb:searchMovies]，参数：', JSON.stringify(query));
    console.log();
    try {
      // return '《警察故事》系列是成龙最具代表性的经典动作片，他在片中饰演正直却常惹麻烦的香港警察陈家驹。该系列以成龙亲自上阵的搏命高危特技、紧张刺激的真实场景动作场面（如商场玻璃滑梯、巴士追逐）以及巧妙融入的诙谐幽默而闻名全球，不仅重新定义了动作电影的标准（1985年首部即夺得香港票房冠军），更成为展现其“功夫喜剧”与“搏命演出”风格的影史里程碑之作。';
      const data = await callTmdbApi<Response<MovieResult>>('movie', query);

      // 仅将图像路径修改为完整的URL
      const results = data.results.map((movie: MovieResult) => {
        if (movie.poster_path) {
          movie.poster_path = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        }
        if (movie.backdrop_path) {
          movie.backdrop_path = `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`;
        }
        return movie;
      });

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
      // 重新抛出错误让 Genkit/调用者适当处理
      throw error;
    }
  }
);

export const searchPeople = ai.defineTool(
  {
    name: 'searchPeople',
    description: '按姓名在TMDB中搜索人物',
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log();
    console.log('正在调用[tmdb:searchPeople]，参数：', JSON.stringify(query));
    console.log();
    try {
      const data = await callTmdbApi<Response<PersonResult>>('person', query);

      // 仅将图像路径修改为完整的URL
      const results = data.results.map((person: any) => {
        if (person.profile_path) {
          person.profile_path = `https://image.tmdb.org/t/p/w500${person.profile_path}`;
        }

        // 同时修改 known_for 作品中的海报路径
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
      // 重新抛出错误让 Genkit/调用者适当处理
      throw error;
    }
  }
);
