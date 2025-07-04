import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";

(async () => {
  // 发起生成请求
  const { response, stream } = await ai.generateStream({
    tools: [searchMovies, searchPeople],
    prompt: [
      {
        text: "请使用 searchMovies 工具查找有关电影《泰坦尼克号》的信息。",
      },
    ],
    system:
      "你是一个有用的助手，可以在 TMDB 数据库中搜索电影和人物。当被要求搜索电影或人物时，你必须使用提供的工具来搜索信息。总是在被要求搜索电影或人物时调用适当的工具。",
  });

  // 流式处理响应以查看生成过程
  for await (const chunk of stream) {
    if (chunk.text) {
      process.stdout.write(chunk.text);
    }
  }
})();
