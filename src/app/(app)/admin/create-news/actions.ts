
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

// Define the structure for the data we expect to receive
interface NewNewsData {
  newsItemString: string;
  imageItemString: string;
}

/**
 * Updates the news data files with a new article and a new image.
 * This function reads the existing files, prepends the new content,
 * and writes the files back to the disk.
 * It's a server action and uses Node.js's fs/promises API.
 */
export async function updateNewsFiles(data: NewNewsData) {
  // IMPORTANT: Resolve paths from the project root (process.cwd())
  const newsFilePath = path.join(process.cwd(), 'src', 'lib', 'news-data.ts');
  const imagesFilePath = path.join(process.cwd(), 'src', 'lib', 'placeholder-images.json');

  try {
    // --- Update news-data.ts ---
    const currentNewsContent = await fs.readFile(newsFilePath, 'utf-8');
    const newsArrayMarker = 'export const newsItems = [';
    const markerIndex = currentNewsContent.indexOf(newsArrayMarker);

    if (markerIndex === -1) {
      throw new Error('Could not find `export const newsItems = [` in news-data.ts');
    }
    const insertionIndex = markerIndex + newsArrayMarker.length;
    const updatedNewsContent =
      currentNewsContent.slice(0, insertionIndex) +
      '\n' + data.newsItemString + ',' +
      currentNewsContent.slice(insertionIndex);
    
    // --- Update placeholder-images.json ---
    const currentImagesContent = await fs.readFile(imagesFilePath, 'utf-8');
    const imagesJson = JSON.parse(currentImagesContent);
    const newImageObject = JSON.parse(data.imageItemString);
    imagesJson.placeholderImages.unshift(newImageObject); // Add to the beginning of the array

    const updatedImagesContent = JSON.stringify(imagesJson, null, 2);

    // --- Write both files ---
    await fs.writeFile(newsFilePath, updatedNewsContent, 'utf-8');
    await fs.writeFile(imagesFilePath, updatedImagesContent, 'utf-8');
    
    return { success: true, message: '新闻文件更新成功！' };
  } catch (error) {
    console.error('Error updating news files:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message: `文件更新失败: ${errorMessage}` };
  }
}
