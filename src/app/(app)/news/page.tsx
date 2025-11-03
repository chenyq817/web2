
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { WithId } from '@/firebase';

type NewsItem = {
  title: string;
  category: string;
  excerpt: string;
  content: string;
  imageBase64: string;
  date: string;
};

const NewsCard = ({ item }: { item: WithId<NewsItem> }) => {
  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <Link href={`/news/${item.id}`} className="flex flex-col flex-grow">
        {item.imageBase64 && (
          <div className="relative aspect-video w-full">
            <Image
              src={item.imageBase64}
              alt={item.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <CardHeader>
          <CardTitle className="font-headline text-lg">{item.title}</CardTitle>
          <Badge variant="secondary" className="w-fit">{item.category}</Badge>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-muted-foreground line-clamp-2">{item.excerpt}</p>
        </CardContent>
        <CardFooter className="flex justify-between items-center mt-auto">
          <p className="text-sm text-muted-foreground">{item.date}</p>
          <div className="flex items-center text-primary font-semibold text-sm">
            阅读更多 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
};

export default function NewsPage() {
  const firestore = useFirestore();
  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('date', 'desc'));
  }, [firestore]);

  const { data: allNews, isLoading } = useCollection<NewsItem>(newsQuery);

  const academicNews = useMemo(() => allNews?.filter(item => item.category === '学术'), [allNews]);
  const sportsNews = useMemo(() => allNews?.filter(item => item.category === '体育'), [allNews]);
  const campusLifeNews = useMemo(() => allNews?.filter(item => item.category === '校园生活' || item.category === "文体艺术"), [allNews]);
  const otherNews = useMemo(() => allNews?.filter(item => item.category === '其他'), [allNews]);

  const renderNewsList = (news: WithId<NewsItem>[] | undefined, categoryName: string) => {
    if (isLoading) {
        return <div className="col-span-full flex justify-center items-center p-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (!news || news.length === 0) {
        return <p className="text-center text-muted-foreground col-span-full py-8">暂无{categoryName}新闻。</p>;
    }
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => <NewsCard key={item.id} item={item} />)}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="校园新闻" />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="academics">学术</TabsTrigger>
            <TabsTrigger value="sports">体育</TabsTrigger>
            <TabsTrigger value="campus-life">校园生活</TabsTrigger>
            <TabsTrigger value="other">其他</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            {renderNewsList(allNews, '全部')}
          </TabsContent>
          <TabsContent value="academics">
            {renderNewsList(academicNews, '学术')}
          </TabsContent>
          <TabsContent value="sports">
            {renderNewsList(sportsNews, '体育')}
          </TabsContent>
          <TabsContent value="campus-life">
            {renderNewsList(campusLifeNews, '校园生活')}
          </TabsContent>
          <TabsContent value="other">
            {renderNewsList(otherNews, '其他')}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
