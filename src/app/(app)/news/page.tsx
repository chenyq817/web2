
import Image from 'next/image';
import Link from 'next/link';
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
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { newsItems } from '@/lib/news-data';
import { ArrowRight } from 'lucide-react';

const NewsCard = ({ item }: { item: typeof newsItems[0] }) => {
  const image = PlaceHolderImages.find(img => img.id === item.imageId);
  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <Link href={`/news/${item.id}`} className="flex flex-col flex-grow">
        {image && (
          <div className="relative aspect-video w-full">
            <Image
              src={image.imageUrl}
              alt={image.description}
              fill
              className="object-cover"
              data-ai-hint={image.imageHint}
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
  const allNews = newsItems;
  const academicNews = newsItems.filter(item => item.category === '学术');
  const sportsNews = newsItems.filter(item => item.category === '体育');
  const campusLifeNews = newsItems.filter(item => item.category === '校园生活' || item.category === "文体艺术");
  const otherNews = newsItems.filter(item => item.category === '其他');

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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {allNews.length > 0 ? allNews.map((item) => <NewsCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground col-span-full">暂无新闻。</p>}
            </div>
          </TabsContent>
          <TabsContent value="academics">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {academicNews.length > 0 ? academicNews.map((item) => <NewsCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground col-span-full">暂无学术新闻。</p>}
            </div>
          </TabsContent>
          <TabsContent value="sports">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sportsNews.length > 0 ? sportsNews.map((item) => <NewsCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground col-span-full">暂无体育新闻。</p>}
            </div>
          </TabsContent>
          <TabsContent value="campus-life">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campusLifeNews.length > 0 ? campusLifeNews.map((item) => <NewsCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground col-span-full">暂无校园生活新闻。</p>}
            </div>
          </TabsContent>
          <TabsContent value="other">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {otherNews.length > 0 ? otherNews.map((item) => <NewsCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground col-span-full">暂无其他新闻。</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
