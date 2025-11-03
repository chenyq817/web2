
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { newsItems } from '@/lib/news-data';
import { ArrowLeft } from 'lucide-react';

// This is now a Server Component
export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use() to unwrap the promise from params
  const resolvedParams = React.use(params);
  const newsItem = newsItems.find(item => item.id.toString() === resolvedParams.id);

  if (!newsItem) {
    notFound();
    return null;
  }

  const image = PlaceHolderImages.find(img => img.id === newsItem.imageId);

  return (
    <div className="flex flex-col h-full">
      <Header title={newsItem.title} />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Button asChild variant="outline" className="mb-6">
            <Link href="/news">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回新闻
            </Link>
          </Button>

          <article className="bg-card rounded-lg shadow-sm border p-6 md:p-8">
            <header className="mb-6">
              <h1 className="text-3xl md:text-4xl font-bold font-headline mb-2">{newsItem.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{newsItem.date}</span>
                <Badge variant="secondary">{newsItem.category}</Badge>
              </div>
            </header>
            
            {image && (
              <div className="relative aspect-video w-full mb-6 rounded-lg overflow-hidden">
                <Image
                  src={image.imageUrl}
                  alt={image.description}
                  fill
                  className="object-cover"
                  data-ai-hint={image.imageHint}
                />
              </div>
            )}
            
            <div 
              className="prose dark:prose-invert max-w-none text-lg"
              dangerouslySetInnerHTML={{ __html: newsItem.content.replace(/\n/g, '<br />') }} 
            />
          </article>
        </div>
      </main>
    </div>
  );
}
