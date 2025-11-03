'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

interface DeleteNewsData {
  newsId: string;
  imageId: string;
}

export async function deleteNewsItem(data: DeleteNewsData) {
  const newsFilePath = path.join(process.cwd(), 'src', 'lib', 'news-data.ts');
  const imagesFilePath = path.join(process.cwd(), 'src', 'lib', 'placeholder-images.json');

  try {
    // --- Update news-data.ts ---
    const currentNewsContent = await fs.readFile(newsFilePath, 'utf-8');
    
    // This is a simplified way to parse the newsItems array.
    // It assumes a consistent format. A more robust solution might use a code parser (AST).
    const newsArrayRegex = /export const newsItems = (\[[\s\S]*?\]);/;
    const newsMatch = currentNewsContent.match(newsArrayRegex);

    if (!newsMatch || !newsMatch[1]) {
      throw new Error('Could not find or parse newsItems array in news-data.ts');
    }

    // We have to use eval here because it's not a JSON file. This is unsafe if the file content can be manipulated from outside.
    // In this controlled environment, it's a pragmatic choice.
    let newsItems;
    try {
        newsItems = eval(newsMatch[1]);
    } catch(e) {
         throw new Error('Failed to evaluate newsItems array from news-data.ts. Check for syntax errors.');
    }

    const newsIndex = newsItems.findIndex((item: any) => item.id === data.newsId);
    if (newsIndex === -1) {
      // If not found, maybe it was already deleted. Return success.
      return { success: true, message: '新闻条目未找到，可能已被删除。' };
    }
    
    newsItems.splice(newsIndex, 1);

    const updatedNewsItemsString = JSON.stringify(newsItems, null, 2);
    const updatedNewsContent = currentNewsContent.replace(newsArrayRegex, `export const newsItems = ${updatedNewsItemsString};`);

    await fs.writeFile(newsFilePath, updatedNewsContent, 'utf-8');

    // --- Update placeholder-images.json ---
    const currentImagesContent = await fs.readFile(imagesFilePath, 'utf-8');
    const imagesJson = JSON.parse(currentImagesContent);

    const imageIndex = imagesJson.placeholderImages.findIndex((img: any) => img.id === data.imageId);
    if (imageIndex > -1) {
        imagesJson.placeholderImages.splice(imageIndex, 1);
    }
    
    const updatedImagesContent = JSON.stringify(imagesJson, null, 2);
    await fs.writeFile(imagesFilePath, updatedImagesContent, 'utf-8');
    
    return { success: true, message: '新闻已成功删除。' };
  } catch (error) {
    console.error('Error deleting news item:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `文件删除失败: ${errorMessage}` };
  }
}

    