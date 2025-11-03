
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Send, Smile, ImagePlus, X } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import type { WithId } from '@/firebase';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type UserProfile = {
    displayName: string;
    avatarId: string;
    imageBase64?: string;
};

type ChatMessage = {
    chatId: string;
    senderId: string;
    content?: string;
    imageBase64?: string;
    createdAt: any;
};

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

const emojis = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🔥', '🎉', '😊', '🙏', '💯', '🙌'];

export default function ChatPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const chatId = params.chatId as string;

    const [newMessageContent, setNewMessageContent] = useState('');
    const [newImage, setNewImage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const chatRef = useMemoFirebase(() => {
        if (!firestore || !chatId) return null;
        return doc(firestore, 'chats', chatId);
    }, [firestore, chatId]);
    const { data: chat, isLoading: isChatLoading } = useDoc<Chat>(chatRef);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !chatId) return null;
        return query(collection(firestore, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    }, [firestore, chatId]);
    const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(messagesQuery);

    const otherParticipantId = useMemo(() => {
        if (chat) {
          return chat.participantIds.find(id => id !== user?.uid);
        }
        if (chatId.includes('-')) {
            const ids = chatId.split('-');
            return ids.find(id => id !== user?.uid);
        }
        return undefined;
    }, [chat, user, chatId]);

    const otherParticipantInfo = useMemo(() => {
        if (!chat || !otherParticipantId) return null;
        return chat.participantInfo[otherParticipantId];
    }, [chat, otherParticipantId]);

    // This effect handles setting up a new chat if one doesn't exist
    useEffect(() => {
        if (isUserLoading || isChatLoading) return;
        if (!user || !firestore) return;

        const setupNewChat = async (otherId: string) => {
             if (!user || !firestore) return;
             const currentChatDocRef = doc(firestore, 'chats', chatId);
             const chatDocSnap = await getDoc(currentChatDocRef);

             // Only proceed if chat doesn't exist
             if(chatDocSnap.exists()) return;

             try {
                const currentUserProfileSnap = await getDoc(doc(firestore, 'users', user.uid));
                const otherUserProfileSnap = await getDoc(doc(firestore, 'users', otherId));

                const currentUserProfile = currentUserProfileSnap.data() as UserProfile;
                const otherUserProfile = otherUserProfileSnap.data() as UserProfile;

                if (currentUserProfile && otherUserProfile) {
                    const newChatData: any = {
                        participantIds: [user.uid, otherId].sort(), // Sort IDs for consistency
                        participantInfo: {
                            [user.uid]: {
                                displayName: currentUserProfile.displayName,
                                avatarId: currentUserProfile.avatarId,
                                ...(currentUserProfile.imageBase64 && { imageBase64: currentUserProfile.imageBase64 }),
                            },
                            [otherId]: {
                                displayName: otherUserProfile.displayName,
                                avatarId: otherUserProfile.avatarId,
                                ...(otherUserProfile.imageBase64 && { imageBase64: otherUserProfile.imageBase64 }),
                            },
                        },
                    };
                    
                    // Use setDocumentNonBlocking to create the chat document
                    // This allows rules to pass for subsequent message writes
                    setDocumentNonBlocking(currentChatDocRef, newChatData, { merge: true });
                }
            } catch (error) {
                console.error("创建新聊天时出错:", error);
            }
        };

        if (chatId.includes('-') && !chat && otherParticipantId) {
           setupNewChat(otherParticipantId);
        }
    }, [chat, isChatLoading, user, isUserLoading, firestore, chatId, otherParticipantId]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = () => {
        if ((!newMessageContent.trim() && !newImage) || !user || !firestore || !chatId) return;

        const messageData: Partial<ChatMessage> = {
            chatId: chatId,
            senderId: user.uid,
            createdAt: serverTimestamp(),
        };

        let lastMessageContent = '';
        if (newImage) {
            messageData.imageBase64 = newImage;
            lastMessageContent = '[图片]';
        }
        if (newMessageContent.trim()) {
            messageData.content = newMessageContent;
            lastMessageContent = newMessageContent.trim();
        }
        
        addDocumentNonBlocking(collection(firestore, 'chats', chatId, 'messages'), messageData);

        const lastMessageData: any = {
            senderId: user.uid,
            timestamp: serverTimestamp(),
            content: lastMessageContent,
        };
        
        if (newImage) {
            lastMessageData.imageBase64 = newImage;
        }
        
        setDocumentNonBlocking(doc(firestore, 'chats', chatId), { lastMessage: lastMessageData }, { merge: true });

        setNewMessageContent('');
        setNewImage(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };
    
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setNewMessageContent(prev => prev + emoji);
    };

    const isLoading = isUserLoading || isChatLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!chat && !isLoading) {
        // This handles the case where the chat doesn't exist and isn't being created.
        return (
             <div className="flex flex-col h-full">
                <Header title="聊天" />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-lg text-muted-foreground">正在准备聊天...</p>
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4" />
                    </div>
                </main>
            </div>
        );
    }
    
    const otherUserAvatarSrc = otherParticipantInfo?.imageBase64 || PlaceHolderImages.find(p => p.id === otherParticipantInfo?.avatarId)?.imageUrl;

    return (
        <div className="flex flex-col h-screen bg-secondary/30">
             <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                     {otherParticipantInfo && otherParticipantId && (
                        <Link href={`/profile/${otherParticipantId}`} passHref>
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={otherUserAvatarSrc} alt={otherParticipantInfo.displayName} />
                                    <AvatarFallback>{otherParticipantInfo.displayName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <h1 className="text-lg font-semibold font-headline md:text-xl">{otherParticipantInfo.displayName}</h1>
                            </div>
                        </Link>
                     )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {areMessagesLoading && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>}
                {messages?.map(message => {
                    const isSender = message.senderId === user?.uid;
                    const senderInfo = chat?.participantInfo[message.senderId];
                    const senderAvatarSrc = senderInfo?.imageBase64 || PlaceHolderImages.find(p => p.id === senderInfo?.avatarId)?.imageUrl;
                    return (
                        <div key={message.id} className={cn("flex items-end gap-3", isSender ? "justify-end" : "justify-start")}>
                            {!isSender && senderInfo && (
                                <Link href={`/profile/${message.senderId}`} passHref>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={senderAvatarSrc} />
                                        <AvatarFallback>{senderInfo.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </Link>
                            )}
                             <div className={cn(
                                "max-w-xs md:max-w-md lg:max-w-lg rounded-xl px-4 py-2 flex flex-col",
                                isSender ? "bg-primary text-primary-foreground" : "bg-background"
                            )}>
                                {message.imageBase64 && (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="relative aspect-square w-48 mb-2 rounded-md overflow-hidden cursor-pointer">
                                                <Image src={message.imageBase64} alt="发送的图片" fill className="object-cover" />
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl h-auto p-0">
                                            <DialogHeader>
                                                <DialogTitle className="sr-only">放大的图片</DialogTitle>
                                            </DialogHeader>
                                            <div className="relative aspect-video">
                                                <Image src={message.imageBase64} alt="放大的已发送图片" fill className="object-contain"/>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                                {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </main>

            <footer className="p-4 bg-background border-t">
                <div className="max-w-4xl mx-auto">
                    {newImage && (
                        <div className="relative w-24 h-24 mb-2">
                            <Image src={newImage} alt="预览" fill className="rounded-md object-cover" />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => {
                                    setNewImage(null);
                                    if(imageInputRef.current) imageInputRef.current.value = '';
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Textarea
                            placeholder="输入消息..."
                            value={newMessageContent}
                            onChange={(e) => setNewMessageContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            rows={1}
                            className="resize-none h-auto max-h-48"
                        />
                        <input
                            type="file"
                            ref={imageInputRef}
                            onChange={handleImageChange}
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif"
                        />
                        <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}>
                            <ImagePlus />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Smile />
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
                        <Button onClick={handleSendMessage} disabled={!newMessageContent.trim() && !newImage}>
                            <Send />
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
