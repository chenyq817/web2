'use client';

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Columns, Send, Smile, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUser, useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, serverTimestamp, orderBy, doc } from "firebase/firestore";
import type { WithId } from "@/firebase";

type UserProfile = {
  displayName: string;
  isAdmin?: boolean;
};

type WallMessage = {
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any;
};

const WallMessageCard = ({ msg }: { msg: WithId<WallMessage> }) => {
    const { user } = useUser();
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isAdmin = userProfile?.isAdmin;
    const isAuthor = user?.uid === msg.authorId;
    const canDelete = isAdmin || isAuthor;

    const handleDelete = () => {
        if (!firestore) return;
        const messageRef = doc(firestore, "wallMessages", msg.id);
        deleteDocumentNonBlocking(messageRef);
    };

    return (
      <div className="group relative p-4 bg-yellow-200 dark:bg-yellow-700 dark:text-yellow-100 rounded-lg shadow-md transform -rotate-1 hover:rotate-0 hover:scale-105 transition-transform">
          <p className="font-serif">{msg.content}</p>
          {canDelete && (
              <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleDelete}
              >
                  <Trash2 className="h-4 w-4" />
              </Button>
          )}
      </div>
    );
};

const emojis = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🔥', '🎉', '😊', '🙏', '💯', '🙌'];

export default function CommunityPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newWallMessage, setNewWallMessage] = useState("");

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const wallMessagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "wallMessages"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: wallMessages, isLoading: wallMessagesLoading } = useCollection<WallMessage>(wallMessagesQuery);
  
  const handleEmojiSelect = (emoji: string) => {
    setNewWallMessage(prev => prev + emoji);
  };
  
  const handlePostWallMessage = () => {
    if (!newWallMessage.trim() || !user || !firestore || !userProfile) return;

    const messageData: WallMessage = {
      content: newWallMessage,
      authorId: user.uid,
      authorName: userProfile.displayName,
      createdAt: serverTimestamp(),
    };

    addDocumentNonBlocking(collection(firestore, "wallMessages"), messageData);
    setNewWallMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="社区墙" />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-1">
          
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
                 <div className="flex items-center gap-3">
                    <Columns className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle className="font-headline text-2xl">留言墙</CardTitle>
                        <CardDescription>留下一条公开的留言，让大家都能看到。</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-lg h-72 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
                    {wallMessagesLoading && <p className="text-muted-foreground">正在加载留言...</p>}
                    {wallMessages && wallMessages.map((msg, index) => (
                      <WallMessageCard key={msg.id} msg={msg} />
                    ))}
                    {!wallMessagesLoading && wallMessages?.length === 0 && (
                      <div className="col-span-full text-center text-muted-foreground self-center">
                          留言墙是空的。快来写点什么吧！
                      </div>
                    )}
                </div>
                 <div className="flex gap-2">
                    <Textarea 
                      placeholder="在墙上写点什么..." 
                      disabled={!user}
                      value={newWallMessage}
                      onChange={(e) => setNewWallMessage(e.target.value)}
                    />
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground" disabled={!user}>
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
                    <Button 
                      size="icon" 
                      aria-label="发布留言" 
                      disabled={!user || !newWallMessage.trim()}
                      onClick={handlePostWallMessage}
                    >
                      <Send/>
                    </Button>
                 </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
