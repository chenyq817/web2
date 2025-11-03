'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

type NewsItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  imageBase64: string;
  date: string;
};

export default function NewsDetailPage() {
  const params = useParams();
  const firestore = useFirestore();
  const newsId = params.id as string;

  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !newsId) {
      return;
    }

    const fetchNewsItem = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const newsRef = doc(firestore, 'news', newsId);
        const docSnap = await getDoc(newsRef);

        if (docSnap.exists()) {
          setNewsItem({ id: docSnap.id, ...docSnap.data() } as NewsItem);
        } else {
          setError("未找到该新闻。");
        }
      } catch (err) {
        console.error("获取新闻详情时出错:", err);
        setError("加载新闻时出错。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNewsItem();
  }, [firestore, newsId]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="新闻详情" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  if (error) {
     notFound();
     return null;
  }
  
  if (!newsItem) {
     return null; // Should be covered by isLoading or error state
  }


  return (
    <div className="flex flex-col h-full">
      <Header title={newsItem.title || "新闻详情"} />
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
            
            {newsItem.imageBase64 && (
              <div className="relative aspect-video w-full mb-6 rounded-lg overflow-hidden">
                <Image
                  src={newsItem.imageBase64}
                  alt={newsItem.title}
                  fill
                  className="object-cover"
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
