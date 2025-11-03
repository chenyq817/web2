
'use client';

import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { WithId } from '@/firebase';

type Chat = {
    participantIds: string[];
    participantInfo: {
        [key: string]: {
            displayName: string;
            avatarId: string;
            imageBase64?: string;
        }
    };
    lastMessage?: {
        content?: string;
        senderId: string;
        timestamp: any;
        imageBase64?: string;
    };
};

export default function ChatListPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const chatsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'chats'),
            where('participantIds', 'array-contains', user.uid),
            orderBy('lastMessage.timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: chats, isLoading: areChatsLoading } = useCollection<Chat>(chatsQuery);

    const handleChatSelect = (chatId: string) => {
        router.push(`/chat/${chatId}`);
    };

    const isLoading = isUserLoading || areChatsLoading;

    return (
        <div className="flex flex-col h-full">
            <Header title="我的聊天" />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="p-0">
                        <div className="h-[75vh] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                </div>
                            ) : chats && chats.length > 0 ? (
                                <ul className="divide-y">
                                    {chats.map(chat => {
                                        const otherParticipantId = chat.participantIds.find(id => id !== user?.uid);
                                        if (!otherParticipantId) return null;

                                        const otherParticipantInfo = chat.participantInfo[otherParticipantId];
                                        if (!otherParticipantInfo) return null;

                                        const avatarSrc = otherParticipantInfo.imageBase64 || PlaceHolderImages.find(p => p.id === otherParticipantInfo.avatarId)?.imageUrl;
                                        
                                        const lastMessageContent = chat.lastMessage?.imageBase64 ? "[图片]" : chat.lastMessage?.content;

                                        return (
                                            <li key={chat.id} onClick={() => handleChatSelect(chat.id)} className="p-4 hover:bg-secondary cursor-pointer transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-12 w-12">
                                                        <AvatarImage src={avatarSrc} alt={otherParticipantInfo.displayName} />
                                                        <AvatarFallback>{otherParticipantInfo.displayName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-grow overflow-hidden">
                                                        <p className="font-semibold truncate">{otherParticipantInfo.displayName}</p>
                                                        <p className="text-sm text-muted-foreground truncate">{lastMessageContent || '暂无聊天记录'}</p>
                                                    </div>
                                                    {chat.lastMessage?.timestamp && (
                                                        <p className="text-xs text-muted-foreground self-start whitespace-nowrap">
                                                            {formatDistanceToNow(chat.lastMessage.timestamp.toDate(), { addSuffix: true })}
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-muted-foreground">你还没有任何聊天。</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
