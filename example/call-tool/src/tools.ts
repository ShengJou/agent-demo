import { ai, z } from "./genkit";
import { callTmdbApi } from "./tmdb";

interface Response {
  page: number;
  results: MovieResult[];
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

export const searchMovies = ai.defineTool(
  {
    name: "searchMovies",
    description: "按标题在TMDB中搜索电影",
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log();
    console.log("正在调用[tmdb:searchMovies]，参数：", JSON.stringify(query));
    console.log();
    try {
      // return '《警察故事》系列是成龙最具代表性的经典动作片，他在片中饰演正直却常惹麻烦的香港警察陈家驹。该系列以成龙亲自上阵的搏命高危特技、紧张刺激的真实场景动作场面（如商场玻璃滑梯、巴士追逐）以及巧妙融入的诙谐幽默而闻名全球，不仅重新定义了动作电影的标准（1985年首部即夺得香港票房冠军），更成为展现其“功夫喜剧”与“搏命演出”风格的影史里程碑之作。';
      const data = await callTmdbApi<Response>("movie", query);

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

      return {
        ...data,
        results,
      };
    } catch (error) {
      console.error("搜索电影时出错:", error);
      // 重新抛出错误让 Genkit/调用者适当处理
      throw error;
    }
  }
);

export const searchPeople = ai.defineTool(
  {
    name: "searchPeople",
    description: "按姓名在TMDB中搜索人物",
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log();
    console.log("正在调用[tmdb:searchPeople]，参数：", JSON.stringify(query));
    console.log();
    try {
      const data = await callTmdbApi<any>("person", query);

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

      return {
        ...data,
        results,
      };
    } catch (error) {
      console.error("搜索人物时出错:", error);
      // 重新抛出错误让 Genkit/调用者适当处理
      throw error;
    }
  }
);
