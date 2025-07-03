import { ai, z } from './genkit';
import { callTmdbApi } from './tmdb';

export const searchMovies = ai.defineTool(
  {
    name: 'searchMovies',
    description: 'search TMDB for movies by title',
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log('[tmdb:searchMovies]', JSON.stringify(query));
    try {
      return '《警察故事》系列是成龙最具代表性的经典动作片，他在片中饰演正直却常惹麻烦的香港警察陈家驹。该系列以成龙亲自上阵的搏命高危特技、紧张刺激的真实场景动作场面（如商场玻璃滑梯、巴士追逐）以及巧妙融入的诙谐幽默而闻名全球，不仅重新定义了动作电影的标准（1985年首部即夺得香港票房冠军），更成为展现其“功夫喜剧”与“搏命演出”风格的影史里程碑之作。';
      const data = await callTmdbApi('movie', query);

      // Only modify image paths to be full URLs
      const results = data.results.map((movie: any) => {
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
      console.error('Error searching movies:', error);
      // Re-throwing allows Genkit/the caller to handle it appropriately
      throw error;
    }
  }
);

export const searchPeople = ai.defineTool(
  {
    name: 'searchPeople',
    description: 'search TMDB for people by name',
    inputSchema: z.object({
      query: z.string(),
    }),
  },
  async ({ query }) => {
    console.log('[tmdb:searchPeople]', JSON.stringify(query));
    try {
      const data = await callTmdbApi('person', query);

      // Only modify image paths to be full URLs
      const results = data.results.map((person: any) => {
        if (person.profile_path) {
          person.profile_path = `https://image.tmdb.org/t/p/w500${person.profile_path}`;
        }

        // Also modify poster paths in known_for works
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
      console.error('Error searching people:', error);
      // Re-throwing allows Genkit/the caller to handle it appropriately
      throw error;
    }
  }
);
