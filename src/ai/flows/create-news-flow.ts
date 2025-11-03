
'use server';
/**
 * @fileOverview A Genkit flow for creating a news article snippet.
 *
 * This flow takes news article data (title, content, category, and an image),
 * and generates stringified JSON objects for a new news item and a new
 * image placeholder. These strings are intended to be inserted into
 * `news-data.ts` and `placeholder-images.json` by a separate server action.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { v4 as uuidv4 } from 'uuid';

// Define the input schema for the flow
const CreateNewsInputSchema = z.object({
  title: z.string().describe('The title of the news article.'),
  content: z.string().describe('The main content of the news article.'),
  category: z.enum(['学术', '体育', '校园生活', '其他']).describe('The category of the news article.'),
  imageBase64: z.string().describe("A Base64 encoded image for the article, as a data URI including MIME type. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type CreateNewsInput = z.infer<typeof CreateNewsInputSchema>;

// Define the output schema for the flow, which will be the stringified objects.
const CreateNewsOutputSchema = z.object({
  newsItemString: z.string().describe('The stringified JSON object for the new news item.'),
  imageItemString: z.string().describe('The stringified JSON object for the new image placeholder item.'),
});
export type CreateNewsOutput = z.infer<typeof CreateNewsOutputSchema>;


/**
 * The main exported function that clients will call.
 * This is a simple wrapper around the Genkit flow.
 */
export async function createNewsSnippet(input: CreateNewsInput): Promise<CreateNewsOutput> {
  return createNewsSnippetFlow(input);
}


// Define the Genkit flow
const createNewsSnippetFlow = ai.defineFlow(
  {
    name: 'createNewsSnippetFlow',
    inputSchema: CreateNewsInputSchema,
    outputSchema: CreateNewsOutputSchema,
  },
  async (input: CreateNewsInput) => {

    // 1. Generate unique IDs for the new content
    const newsId = uuidv4().substring(0, 8); // A shorter ID for news
    const imageId = `news-${newsId}`;

    // 2. Create the new image placeholder object
    const newImageEntry = {
      id: imageId,
      description: input.title, // Use news title as description
      imageUrl: input.imageBase64,
      imageHint: "custom upload"
    };

    // 3. Create the new news item object
    const newNewsItem = {
      id: newsId,
      title: input.title,
      category: input.category,
      excerpt: input.content.substring(0, 100).replace(/\n/g, ' ') + '...',
      content: input.content,
      imageId: imageId,
      date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
    };
      
    // 4. Return the stringified versions of the objects
    return {
      newsItemString: JSON.stringify(newNewsItem, null, 2),
      imageItemString: JSON.stringify(newImageEntry, null, 2),
    };
  }
);
