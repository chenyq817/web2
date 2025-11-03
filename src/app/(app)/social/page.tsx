
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus, Check, X, Loader2, MessageSquare } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, getDocs, writeBatch, arrayUnion, arrayRemove, doc, getDoc } from 'firebase/firestore';
import type { WithId } from '@/firebase';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type FriendRequest = {
  userId: string;
  message: string;
};

type UserProfile = {
  displayName: string;
  avatarId: string;
  imageBase64?: string;
  friendIds?: string[];
  friendRequestsSent?: FriendRequest[];
  friendRequestsReceived?: FriendRequest[];
  displayName_lowercase?: string;
};

type EnrichedFriendRequest = {
    profile: WithId<UserProfile>;
    message: string;
}

export default function SocialPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<WithId<UserProfile>[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [verificationMessage, setVerificationMessage] = useState('');
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
    const [selectedUserForRequest, setSelectedUserForRequest] = useState<WithId<UserProfile> | null>(null);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: currentUserProfile } = useDoc<UserProfile>(userProfileRef);

    const [friendRequests, setFriendRequests] = useState<EnrichedFriendRequest[]>([]);
    const [friends, setFriends] = useState<WithId<UserProfile>[]>([]);
    
    const fetchProfilesByIds = async (ids: string[]): Promise<WithId<UserProfile>[]> => {
        if (!firestore || ids.length === 0) return [];
        
        const profilePromises = ids.map(id => getDoc(doc(firestore, 'users', id)));
        
        return Promise.all(profilePromises)
            .then(profileSnapshots => {
                return profileSnapshots
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as WithId<UserProfile>));
            })
            .catch(error => {
                console.error("Error fetching profiles by IDs:", error);
                const permissionError = new FirestorePermissionError({
                    path: `users/[${ids.join(',')}]`,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
                return [];
            });
    };


    useEffect(() => {
        if (currentUserProfile?.friendRequestsReceived) {
            const requestUserIds = currentUserProfile.friendRequestsReceived.map(req => req.userId);
            fetchProfilesByIds(requestUserIds).then(profiles => {
                const enrichedRequests = profiles.map(profile => {
                    const request = currentUserProfile.friendRequestsReceived?.find(req => req.userId === profile.id);
                    return {
                        profile: profile,
                        message: request?.message || ''
                    };
                });
                setFriendRequests(enrichedRequests);
            });
        } else {
            setFriendRequests([]);
        }

        if (currentUserProfile?.friendIds) {
            fetchProfilesByIds(currentUserProfile.friendIds).then(setFriends);
        } else {
            setFriends([]);
        }
    }, [currentUserProfile]);

    const handleSearch = async () => {
        if (!searchTerm.trim() || !firestore || !user) return;
        setIsSearching(true);
        try {
            const usersRef = collection(firestore, "users");
            const q = query(usersRef, where("displayName", ">=", searchTerm), where("displayName", "<=", searchTerm + '\uf8ff'));
            const querySnapshot = await getDocs(q);
            const results = querySnapshot.docs
                .map(doc => ({ ...doc.data() as UserProfile, id: doc.id }))
                .filter(p => p.id !== user.uid);
            setSearchResults(results);
        } catch (error) {
            console.error("Error searching users: ", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleFriendAction = async (targetUserId: string, action: 'accept' | 'decline' | 'remove', message: string = '') => {
        if (!firestore || !user || !currentUserProfile) return;
        setActionLoading(targetUserId);

        const currentUserRef = doc(firestore, 'users', user.uid);
        const targetUserRef = doc(firestore, 'users', targetUserId);
        
        try {
            const batch = writeBatch(firestore);

            const currentUserRequest = { userId: user.uid, message: message };
            const targetUserRequest = { userId: targetUserId, message: message };

            switch (action) {
                case 'accept':
                    const updatedReceived = currentUserProfile.friendRequestsReceived?.filter(req => req.userId !== targetUserId) || [];
                    batch.update(currentUserRef, { 
                        friendIds: arrayUnion(targetUserId), 
                        friendRequestsReceived: updatedReceived 
                    });
                    
                    const targetUserProfileSnap = await getDoc(targetUserRef);
                    const targetUserProfile = targetUserProfileSnap.data() as UserProfile;
                    const updatedSent = targetUserProfile.friendRequestsSent?.filter(req => req.userId !== user.uid) || [];
                    batch.update(targetUserRef, { 
                        friendIds: arrayUnion(user.uid), 
                        friendRequestsSent: updatedSent
                    });
                    break;
                case 'decline':
                    const receivedAfterDecline = currentUserProfile.friendRequestsReceived?.filter(req => req.userId !== targetUserId) || [];
                    batch.update(currentUserRef, { friendRequestsReceived: receivedAfterDecline });

                    const targetSnapDecline = await getDoc(targetUserRef);
                    const targetProfileDecline = targetSnapDecline.data() as UserProfile;
                    const sentAfterDecline = targetProfileDecline.friendRequestsSent?.filter(req => req.userId !== user.uid) || [];
                    batch.update(targetUserRef, { friendRequestsSent: sentAfterDecline });
                    break;
                case 'remove':
                     batch.update(currentUserRef, { friendIds: arrayRemove(targetUserId) });
                     batch.update(targetUserRef, { friendIds: arrayRemove(user.uid) });
                    break;
            }
            await batch.commit();
        } catch (error) {
            console.error(`Error during friend action '${action}':`, error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${targetUserId}`, operation: 'update' }));
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleOpenRequestDialog = (user: WithId<UserProfile>) => {
        setSelectedUserForRequest(user);
        setIsRequestDialogOpen(true);
    };

    const handleSendRequest = async () => {
        if (!firestore || !user || !selectedUserForRequest) return;
        setActionLoading(selectedUserForRequest.id);
        setIsRequestDialogOpen(false);
        
        const currentUserRef = doc(firestore, 'users', user.uid);
        const targetUserRef = doc(firestore, 'users', selectedUserForRequest.id);

        try {
            const batch = writeBatch(firestore);
            const message = verificationMessage || `你好，我是${currentUserProfile?.displayName}。`;
            
            batch.update(currentUserRef, { friendRequestsSent: arrayUnion({ userId: selectedUserForRequest.id, message }) });
            batch.update(targetUserRef, { friendRequestsReceived: arrayUnion({ userId: user.uid, message }) });
            
            await batch.commit();
        } catch (error) {
            console.error("Error sending friend request:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${selectedUserForRequest.id}`, operation: 'update' }));
        } finally {
            setActionLoading(null);
            setVerificationMessage('');
            setSelectedUserForRequest(null);
        }
    }

    const handleMessage = (friendId: string) => {
        if(!user) return;
        const chatId = [user.uid, friendId].sort().join('-');
        router.push(`/chat/${chatId}`);
    };

    const UserCard = ({ profile, type, message }: { profile: WithId<UserProfile>; type: 'search' | 'request' | 'friend', message?: string }) => {
        const avatarSrc = profile.imageBase64 || PlaceHolderImages.find(p => p.id === profile.avatarId)?.imageUrl;
        const isLoading = actionLoading === profile.id;

        const getActionType = () => {
            if (currentUserProfile?.friendIds?.includes(profile.id)) return 'friend';
            if (currentUserProfile?.friendRequestsSent?.some(req => req.userId === profile.id)) return 'sent';
            return 'add';
        };

        return (
            <div className="flex flex-col p-3 rounded-lg hover:bg-secondary">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/profile/${profile.id}`} passHref>
                          <Avatar>
                              <AvatarImage src={avatarSrc} alt={profile.displayName} />
                              <AvatarFallback>{profile.displayName.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Link>
                        <p className="font-medium">{profile.displayName}</p>
                    </div>
                    <div className="flex gap-2">
                        {isLoading ? <Button size="sm" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button> :
                         type === 'search' && (
                             <>
                                {getActionType() === 'add' && <Button size="sm" onClick={() => handleOpenRequestDialog(profile)}><UserPlus className="mr-2 h-4 w-4" /> 添加</Button>}
                                {getActionType() === 'sent' && <Button size="sm" variant="outline" disabled>已发送</Button>}
                                {getActionType() === 'friend' && <Button size="sm" variant="ghost" disabled>好友</Button>}
                             </>
                         )}
                         {type === 'request' && !isLoading && (
                             <>
                                <Button size="icon" onClick={() => handleFriendAction(profile.id, 'accept')}><Check className="w-4 h-4" /></Button>
                                <Button size="icon" variant="outline" onClick={() => handleFriendAction(profile.id, 'decline')}><X className="w-4 h-4" /></Button>
                             </>
                         )}
                         {type === 'friend' && !isLoading && (
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleMessage(profile.id)}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    发送消息
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleFriendAction(profile.id, 'remove')}>
                                    移除好友
                                </Button>
                            </div>
                         )}
                    </div>
                </div>
                 {type === 'request' && message && (
                    <p className="text-sm text-muted-foreground mt-2 ml-12 p-2 bg-background rounded-md">{message}</p>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="社交中心" />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                 <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>发送好友请求给 {selectedUserForRequest?.displayName}</DialogTitle>
                            <DialogDescription>
                                添加一条验证消息，让对方更好地认识你。
                            </DialogDescription>
                        </DialogHeader>
                        <Textarea
                            placeholder={`你好，我是${currentUserProfile?.displayName}...`}
                            value={verificationMessage}
                            onChange={(e) => setVerificationMessage(e.target.value)}
                        />
                        <DialogFooter>
                             <DialogClose asChild>
                                <Button type="button" variant="secondary">取消</Button>
                            </DialogClose>
                            <Button type="button" onClick={handleSendRequest}>发送</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Tabs defaultValue="friends" className="max-w-4xl mx-auto">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="friends">我的好友</TabsTrigger>
                        <TabsTrigger value="requests">好友请求 ({friendRequests.length})</TabsTrigger>
                        <TabsTrigger value="search">查找用户</TabsTrigger>
                    </TabsList>
                    <TabsContent value="friends">
                        <Card>
                             <CardHeader>
                                <CardTitle>我的好友</CardTitle>
                                <CardDescription>管理您的好友并开始对话。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 h-[60vh] overflow-y-auto">
                                {friends.length > 0 ? friends.map(profile => (
                                    <UserCard key={profile.id} profile={profile} type="friend" />
                                )) : (
                                    <p className="text-muted-foreground text-center pt-8">您的好友列表为空，快去寻找好友吧！</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="requests">
                         <Card>
                            <CardHeader>
                                <CardTitle>好友请求</CardTitle>
                                <CardDescription>接受或拒绝来自其他用户的好友请求。</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 h-[60vh] overflow-y-auto">
                               {friendRequests.length > 0 ? friendRequests.map(req => (
                                   <UserCard key={req.profile.id} profile={req.profile} type="request" message={req.message} />
                               )) : (
                                 <p className="text-muted-foreground text-center pt-8">没有待处理的好友请求。</p>
                               )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="search">
                        <Card>
                            <CardHeader>
                                <CardTitle>发现新朋友</CardTitle>
                                <CardDescription>按昵称搜索其他用户。</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="输入昵称..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <Button onClick={handleSearch} disabled={isSearching}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <div className="mt-4 space-y-2 h-[50vh] overflow-y-auto">
                                    {isSearching && <p className="text-muted-foreground text-center">正在搜索...</p>}
                                    {!isSearching && searchResults.length > 0 && searchResults.map(profile => (
                                        <UserCard key={profile.id} profile={profile} type="search" />
                                    ))}
                                    {!isSearching && searchResults.length === 0 && searchTerm && (
                                        <p className="text-muted-foreground text-center pt-4">未找到用户。</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
