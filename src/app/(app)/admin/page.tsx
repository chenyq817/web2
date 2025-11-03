'use client';

import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Newspaper, PlusCircle, ArrowLeft, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUser, useFirestore, deleteDocumentNonBlocking, useDoc, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { collection, query, orderBy, doc, getDocs } from "firebase/firestore";
import type { WithId } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { newsItems as initialNewsItems } from '@/lib/news-data';
import { useToast } from "@/hooks/use-toast";
import { deleteNewsItem } from './actions';

type ContentItem = {
    id: string;
    type: '帖子' | '留言';
    authorId: string;
    authorName: string;
    content: string;
    createdAt: any;
};

type UserProfile = WithId<{
  displayName: string;
  avatarId: string;
  imageBase64?: string;
  email?: string; 
}>;

type NewsItem = typeof initialNewsItems[0];


export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [news, setNews] = useState<NewsItem[]>(initialNewsItems);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const isAuthorized = user?.email === 'admin@111.com';

  useEffect(() => {
    if (!user || !isAuthorized) return;
    if (!firestore) return;

    const fetchAllData = async () => {
        setIsContentLoading(true);
        try {
            const postsQuery = query(collection(firestore, 'posts'), orderBy('createdAt', 'desc'));
            const postsSnapshot = await getDocs(postsQuery);
            const postsData = postsSnapshot.docs.map(doc => ({
                ...(doc.data() as any),
                id: doc.id,
                type: '帖子' as const,
            }));

            const wallMessagesQuery = query(collection(firestore, 'wallMessages'), orderBy('createdAt', 'desc'));
            const wallMessagesSnapshot = await getDocs(wallMessagesQuery);
            const wallMessagesData = wallMessagesSnapshot.docs.map(doc => ({
                ...(doc.data() as any),
                id: doc.id,
                type: '留言' as const,
            }));

            const combinedContent = [...postsData, ...wallMessagesData]
                .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

            setAllContent(combinedContent);
            
            const usersQuery = query(collection(firestore, 'users'));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
              .filter(u => u.id !== user.uid); 
            
            setAllUsers(usersData);

        } catch (error) {
            console.error("获取管理员面板数据时出错:", error);
        } finally {
            setIsContentLoading(false);
        }
    };

    fetchAllData();
  }, [firestore, user, isAuthorized]);


  const handleDeleteNews = async (newsId: string, imageId: string) => {
    setIsDeleting(newsId);
    try {
      const result = await deleteNewsItem({ newsId, imageId });
      if (result.success) {
        setNews(prevNews => prevNews.filter(item => item.id !== newsId));
        toast({
          title: "删除成功",
          description: "新闻已成功删除。",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error instanceof Error ? error.message : "发生未知错误。",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteContent = (item: ContentItem) => {
    if (!firestore) return;
    const collectionName = item.type === '帖子' ? 'posts' : 'wallMessages';
    const itemRef = doc(firestore, collectionName, item.id);
    deleteDocumentNonBlocking(itemRef);
    setAllContent(prevContent => prevContent.filter(content => content.id !== item.id));
  };


  if (isUserLoading) {
     return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4">正在验证权限...</p>
      </div>
    );
  }
  
  if (!isAuthorized) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center">
        <Header title="无权访问"/>
        <main className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold">无权访问</h2>
            <p className="text-muted-foreground mt-2">您没有权限查看此页面。</p>
            <Button onClick={() => router.push('/')} className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回主页
            </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="管理后台" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>新闻管理</CardTitle>
                <CardDescription>创建和管理静态新闻内容。</CardDescription>
              </div>
              <Button asChild>
                <Link href="/admin/create-news">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  发布新闻
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>标题</TableHead>
                            <TableHead>分类</TableHead>
                            <TableHead>发布日期</TableHead>
                             <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {news.slice(0, 5).map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.title}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{item.category}</Badge>
                                </TableCell>
                                <TableCell>{item.date}</TableCell>
                                <TableCell className="text-right">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" disabled={isDeleting === item.id}>
                                        {isDeleting === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        删除
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          此操作无法撤销。这将永久删除该新闻条目。
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteNews(item.id, item.imageId)}
                                          className="bg-destructive hover:bg-destructive/90"
                                        >
                                          确认删除
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {!isContentLoading && news.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        暂无新闻。
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>用户管理</CardTitle>
                <CardDescription>查看和管理系统中除您之外的所有用户。</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>头像</TableHead>
                            <TableHead>昵称</TableHead>
                            <TableHead><span className="sr-only">操作</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allUsers.map(profile => {
                          const avatarSrc = profile.imageBase64 || PlaceHolderImages.find(p => p.id === profile.avatarId)?.imageUrl;
                          return (
                            <TableRow key={profile.id}>
                                <TableCell>
                                  <Link href={`/profile/${profile.id}`}>
                                    <Avatar>
                                        <AvatarImage src={avatarSrc} alt={profile.displayName} />
                                        <AvatarFallback>{profile.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                  </Link>
                                </TableCell>
                                <TableCell className="font-medium flex items-center gap-2">
                                  {profile.displayName}
                                  {profile.email === 'admin@111.com' && <Badge variant="destructive">管理员</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/profile/${profile.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        查看资料
                                      </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                </Table>
                 {isContentLoading ? <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : allUsers.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        未找到其他用户。
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>内容审核</CardTitle>
                <CardDescription>审核和管理所有用户提交的帖子和留言。</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>作者</TableHead>
                            <TableHead>内容</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead><span className="sr-only">操作</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allContent.map(item => (
                            <TableRow key={`${item.type}-${item.id}`}>
                                <TableCell className="font-medium">{item.authorName}</TableCell>
                                <TableCell className="truncate max-w-sm">{item.content}</TableCell>
                                <TableCell>
                                    <Badge variant={item.type === '帖子' ? 'secondary' : 'outline'}>
                                        {item.type}
                                    </Badge>
                                </TableCell>
                                <TableCell>{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">切换菜单</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                                            <DropdownMenuItem
                                              className="text-destructive"
                                              onClick={() => handleDeleteContent(item)}
                                            >
                                              删除
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {isContentLoading ? <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> : allContent.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        没有需要审核的内容。
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

    