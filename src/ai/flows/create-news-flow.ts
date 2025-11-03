
'use server';
/**
 * @fileOverview A Genkit flow for creating a news article object.
 *
 * This flow takes news article data (title, content, category, and an image),
 * and generates a structured JSON object for a new news item, ready to be
 * inserted into Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input schema for the flow
const CreateNewsInputSchema = z.object({
  title: z.string().describe('The title of the news article.'),
  content: z.string().describe('The main content of the news article.'),
  category: z.enum(['学术', '体育', '校园生活', '其他']).describe('The category of the news article.'),
  imageBase64: z.string().describe("A Base64 encoded image for the article, as a data URI including MIME type. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type CreateNewsInput = z.infer<typeof CreateNewsInputSchema>;

// Define the output schema for the flow, which will be the news object.
const NewsObjectSchema = z.object({
  title: z.string(),
  content: z.string(),
  category: z.string(),
  excerpt: z.string(),
  imageBase64: z.string(),
  date: z.string(),
});
export type NewsObject = z.infer<typeof NewsObjectSchema>;


/**
 * The main exported function that clients will call.
 * This is a simple wrapper around the Genkit flow.
 */
export async function createNewsObject(input: CreateNewsInput): Promise<NewsObject> {
  return createNewsObjectFlow(input);
}


// Define the Genkit flow
const createNewsObjectFlow = ai.defineFlow(
  {
    name: 'createNewsObjectFlow',
    inputSchema: CreateNewsInputSchema,
    outputSchema: NewsObjectSchema,
  },
  async (input: CreateNewsInput) => {
    
    // Create the new news item object
    const newNewsItem = {
      title: input.title,
      category: input.category,
      excerpt: input.content.substring(0, 100).replace(/\n/g, ' ') + '...',
      content: input.content,
      imageBase64: input.imageBase64,
      date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
    };
      
    return newNewsItem;
  }
);
