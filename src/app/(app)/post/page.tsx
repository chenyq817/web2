'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from "next/image";
import Link from 'next/link';
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, MessageSquare, ImagePlus, X, MoreHorizontal, Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useUser, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useDoc, errorEmitter, FirestorePermissionError, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, arrayUnion, doc, writeBatch, increment, getDocs } from 'firebase/firestore';
import type { WithId } from '@/firebase';
import { Separator } from '@/components/ui/separator';

// Types matching Firestore data
type Post = {
  authorId: string;
  authorName: string; 
  authorAvatarId?: string; 
  authorImageBase64?: string;
  content: string;
  imageBase64?: string; 
  likeIds: string[];
  commentCount: number;
  createdAt: any; 
};

type Comment = {
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatarId?: string;
    authorImageBase64?: string;
    content: string;
    createdAt: any;
};

type UserProfile = {
  displayName: string;
  avatarId: string;
  avatarUrl?: string; // For backward compatibility
  imageBase64?: string;
  bio?: string;
  age?: number;
  gender?: string;
  address?: string;
};

const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return '刚刚';
      if (typeof timestamp.toDate !== 'function') {
        return '发布中...';
      }
      const date = timestamp.toDate();
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}天前`;
      if (hours > 0) return `${hours}小时前`;
      if (minutes > 0) return `${minutes}分钟前`;
      return '刚刚';
};


function CommentCard({ post, comment }: { post: WithId<Post>, comment: WithId<Comment>}) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const authorAvatarSrc = comment.authorImageBase64 || PlaceHolderImages.find(img => img.id === comment.authorAvatarId)?.imageUrl;
    
    const isAdmin = user?.email === 'admin@111.com';
    const isAuthor = user?.uid === comment.authorId;
    const canDelete = isAdmin || isAuthor;

    const handleDelete = () => {
        if (!firestore) return;
        const postRef = doc(firestore, 'posts', post.id);
        const commentRef = doc(firestore, 'posts', post.id, 'comments', comment.id);

        deleteDocumentNonBlocking(commentRef);
        updateDocumentNonBlocking(postRef, { commentCount: increment(-1) });
        
        setIsDeleteDialogOpen(false);
    };

    return (
        <div className="flex items-start gap-3 group">
            <Link href={`/profile/${comment.authorId}`} passHref>
                <Avatar className="h-9 w-9">
                    {authorAvatarSrc && <AvatarImage src={authorAvatarSrc} alt={comment.authorName} />}
                    <AvatarFallback>{comment.authorName.charAt(0)}</AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-grow bg-secondary/50 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{comment.authorName}</p>
                    <p className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</p>
                </div>
                <p className="text-sm">{comment.content}</p>
            </div>
             {canDelete && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>删除这条评论？</AlertDialogTitle>
                            <AlertDialogDescription>
                                此操作无法撤销。这将永久删除该评论。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">删除</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

function CommentSection({ post }: { post: WithId<Post>}) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [newCommentContent, setNewCommentContent] = useState('');

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const commentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    }, [firestore, post.id]);

    const { data: comments, isLoading } = useCollection<Comment>(commentsQuery);

    const handleComment = async () => {
        if (!newCommentContent.trim() || !firestore || !user || !userProfile) return;

        const postRef = doc(firestore, 'posts', post.id);
        const commentsColRef = collection(firestore, 'posts', post.id, 'comments');
        
        const commentData: Comment = {
            postId: post.id,
            authorId: user.uid,
            authorName: userProfile.displayName,
            authorImageBase64: userProfile.imageBase64 || "",
            authorAvatarId: userProfile.avatarId || "avatar-4",
            content: newCommentContent,
            createdAt: serverTimestamp(),
        };

        addDocumentNonBlocking(commentsColRef, commentData);
        updateDocumentNonBlocking(postRef, { commentCount: increment(1) });
        
        setNewCommentContent('');
    };
    
    const userAvatarSrc = userProfile?.imageBase64 || PlaceHolderImages.find(img => img.id === userProfile?.avatarId)?.imageUrl;

    return (
        <div className="pt-4 space-y-4 px-6 pb-4">
            <Separator />
            <div className="space-y-4">
                {isLoading && <p className="text-sm text-muted-foreground">正在加载评论...</p>}
                {comments?.map(comment => <CommentCard key={comment.id} post={post} comment={comment} />)}
            </div>

            <div className="flex items-start gap-3 pt-4">
                {user && userProfile && (
                <Link href="/profile" passHref>
                    <Avatar className="h-9 w-9">
                        {userAvatarSrc && <AvatarImage src={userAvatarSrc} alt={userProfile.displayName} />}
                        <AvatarFallback>{userProfile.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Link>
                )}
                <div className="flex-grow flex items-center gap-2">
                    <Textarea 
                        placeholder="写一条评论..." 
                        className="min-h-0 h-10"
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                        disabled={!user}
                    />
                    <Button size="icon" onClick={handleComment} disabled={!newCommentContent.trim() || !user}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

function SocialPostCard({ post }: { post: WithId<Post> }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isCommentSectionOpen, setIsCommentSectionOpen] = useState(false);

    const authorAvatarSrc = post.authorImageBase64 || PlaceHolderImages.find(img => img.id === post.authorAvatarId)?.imageUrl;
    
    const isLiked = user ? post.likeIds.includes(user.uid) : false;
    const isAdmin = user?.email === 'admin@111.com';
    const isAuthor = user ? user.uid === post.authorId : false;
    const canDelete = isAdmin || isAuthor;

    const handleLike = () => {
        if (!firestore || !user || isLiked) return;
        const postRef = doc(firestore, 'posts', post.id);
        const data = {
            likeIds: arrayUnion(user.uid)
        };
        updateDocumentNonBlocking(postRef, data);
    };

    const handleDelete = () => {
      if (!firestore) return;
      const postRef = doc(firestore, 'posts', post.id);
      const commentsRef = collection(firestore, 'posts', post.id, 'comments');
      
      const batchPromise = getDocs(commentsRef).then(querySnapshot => {
        const batch = writeBatch(firestore);
        querySnapshot.forEach(commentDoc => {
          batch.delete(commentDoc.ref);
        });
        batch.delete(postRef);
        return batch.commit();
      });
  
      batchPromise.catch(error => {
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: postRef.path,
        });
        errorEmitter.emit('permission-error', contextualError);
      });
  
      setIsDeleteDialogOpen(false);
    }
    
    return (
        <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-start gap-4">
                <Link href={`/profile/${post.authorId}`} passHref>
                    <Avatar>
                        {authorAvatarSrc && <AvatarImage src={authorAvatarSrc} alt={post.authorName} />}
                        <AvatarFallback>{post.authorName.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{post.authorName}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(post.createdAt)}</p>
                    </div>
                </div>
                {canDelete && (
                   <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">更多操作</span>
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
                              </AlertDialogTrigger>
                          </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>你确定要删除吗？</AlertDialogTitle>
                          <AlertDialogDescription>
                            此操作无法撤销。这将永久删除您的帖子及其所有评论。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">删除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                   </AlertDialog>
                )}
            </CardHeader>
            <CardContent>
                <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
                {post.imageBase64 && (
                     <Dialog>
                        <DialogTrigger asChild>
                           <div className="relative aspect-video w-full rounded-md overflow-hidden cursor-pointer">
                                <Image
                                    src={post.imageBase64}
                                    alt="社交帖子图片"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl h-auto p-0">
                            <DialogHeader>
                                <DialogTitle className="sr-only">放大的帖子图片</DialogTitle>
                            </DialogHeader>
                           <div className="relative aspect-video">
                                <Image
                                    src={post.imageBase64}
                                    alt="放大的社交帖子图片"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </CardContent>
            <CardFooter className="flex justify-start gap-4 border-t pt-4">
              <Button 
                  variant="ghost" 
                  className={cn(
                      "flex items-center gap-2",
                      isLiked ? "text-primary" : "text-muted-foreground"
                  )} 
                  onClick={handleLike}
                  disabled={!user || isLiked}
              >
                  <ThumbsUp className={cn("w-5 h-5", isLiked && "fill-current")} /> {post.likeIds.length}
              </Button>
              <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 text-muted-foreground"
                  onClick={() => setIsCommentSectionOpen(prev => !prev)}
              >
                  <MessageSquare className="w-5 h-5" /> {post.commentCount || 0}
              </Button>
            </CardFooter>
            {isCommentSectionOpen && <CommentSection post={post} />}
        </Card>
    );
}

const emojis = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🔥', '🎉', '😊', '🙏', '💯', '🙌'];

export default function PostPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImage, setNewPostImage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
  
    const postsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'posts'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: socialPosts, isLoading } = useCollection<Post>(postsQuery);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const userAvatarSrc = userProfile?.imageBase64 || PlaceHolderImages.find(img => img.id === userProfile?.avatarId)?.imageUrl;

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewPostImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleEmojiSelect = (emoji: string) => {
        setNewPostContent(prev => prev + emoji);
    };

    const handlePost = () => {
        if ((!newPostContent.trim() && !newPostImage) || !user || !firestore || !userProfile) return;

        const postData: Partial<Post> = {
            authorId: user.uid,
            authorName: userProfile.displayName,
            content: newPostContent,
            likeIds: [],
            commentCount: 0,
            createdAt: serverTimestamp(),
        };
        
        if (userProfile.imageBase64) {
            postData.authorImageBase64 = userProfile.imageBase64;
        } else {
            postData.authorAvatarId = userProfile.avatarId || "avatar-4";
        }

        if (newPostImage) {
            postData.imageBase64 = newPostImage;
        }
        
        addDocumentNonBlocking(collection(firestore, 'posts'), postData);

        setNewPostContent('');
        setNewPostImage(null);
        if(imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="校园帖子" />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-col items-start gap-4 p-4">
                            <div className="flex w-full gap-4">
                                {user && userProfile && (
                                <Link href="/profile" passHref>
                                    <Avatar>
                                        {userAvatarSrc && <AvatarImage src={userAvatarSrc} alt="你的头像" />}
                                        <AvatarFallback>{userProfile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                )}
                                <div className="flex-grow">
                                    <Textarea 
                                        placeholder="说点什么..." 
                                        className="mb-2" 
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                        disabled={!user}
                                    />
                                </div>
                            </div>
                             {newPostImage && (
                                <div className="relative w-full pl-16">
                                    <Image src={newPostImage} alt="预览" width={80} height={80} className="rounded-md object-cover" />
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6"
                                        onClick={() => {
                                            setNewPostImage(null);
                                            if(imageInputRef.current) {
                                                imageInputRef.current.value = ''
                                            }
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardFooter className="flex justify-between items-center p-4 border-t">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()} disabled={!user}>
                                    <ImagePlus className="w-5 h-5"/>
                                </Button>
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={!user}>
                                            <Smile className="w-5 h-5"/>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto border-none bg-transparent shadow-none">
                                        <div className="grid grid-cols-6 gap-2 p-2 rounded-lg bg-background border shadow-lg">
                                            {emojis.map(emoji => (
                                                <Button 
                                                    key={emoji}
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEmojiSelect(emoji)}
                                                    className="text-2xl"
                                                >
                                                    {emoji}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <input
                                    type="file"
                                    ref={imageInputRef}
                                    onChange={handleImageChange}
                                    className="hidden"
                                    accept="image/png, image/jpeg, image/gif"
                                />
                            </div>
                            <Button 
                                onClick={handlePost} 
                                disabled={(!newPostContent.trim() && !newPostImage) || !user}
                            >
                                发布
                            </Button>
                        </CardFooter>
                    </Card>

                    {isLoading ? (
                        <div className="space-y-4">
                            <Card><CardHeader><div className="h-20 w-full bg-muted animate-pulse rounded-md"></div></CardHeader></Card>
                            <Card><CardHeader><div className="h-20 w-full bg-muted animate-pulse rounded-md"></div></CardHeader></Card>
                        </div>
                    ) : socialPosts && socialPosts.length > 0 ? (
                         <div className="space-y-4">
                            {socialPosts.map(post => (
                                <SocialPostCard key={post.id} post={post} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground">还没有帖子。</p>
                            <p className="text-sm text-muted-foreground">成为第一个分享的人吧！</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
