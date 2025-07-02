import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";

(async () => {
  // make a generation request
  const { response, stream } = await ai.generateStream({
    tools: [searchMovies, searchPeople],
    prompt: [
      {
        text: "Please use the searchMovies tool to find information about the movie Titanic.",
      },
    ],
    system:
      "You are a helpful assistant that can search the TMDB database for movies and people. You MUST use the provided tools to search for information. Always call the appropriate tool when asked to search for movies or people.",
  });

  // Stream the response to see the generation process
  for await (const chunk of stream) {
    if (chunk.text) {
      process.stdout.write(chunk.text);
    }
  }
})();
