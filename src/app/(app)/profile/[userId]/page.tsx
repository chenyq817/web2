
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import Image from 'next/image';
import { Header } from '@/components/layout/header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Loader2, User, ArrowLeft, Cake, VenetianMask, MapPin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UserProfile = {
  displayName: string;
  avatarId: string;
  imageBase64?: string;
  bio?: string;
  age?: number;
  gender?: '男' | '女' | '其他' | '不愿透露';
  address?: string;
  email?: string;
};

const genderMap = {
  'Male': '男',
  'Female': '女',
  'Other': '其他',
  'Prefer not to say': '不愿透露'
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const userId = params.userId as string;

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col h-full">
        <Header title="未找到用户" />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-lg text-muted-foreground">无法找到该用户个人资料。</p>
           <Button onClick={() => router.back()} variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回
          </Button>
        </main>
      </div>
    );
  }
  
  const profileAvatarSrc = userProfile.imageBase64 || PlaceHolderImages.find(p => p.id === userProfile.avatarId)?.imageUrl;
  const displayGender = userProfile.gender && userProfile.gender !== "不愿透露" 
    ? (genderMap[userProfile.gender as keyof typeof genderMap] || userProfile.gender) 
    : '未设置';


  return (
    <div className="flex flex-col h-full">
      <Header title={`${userProfile.displayName}的个人资料`} />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回
          </Button>
          <Card className="overflow-hidden shadow-lg">
             <CardHeader className="flex flex-col items-center justify-center gap-4 p-6 text-center bg-card">
                <Avatar className="h-28 w-28 border-4 border-background shadow-md">
                    {profileAvatarSrc && <AvatarImage src={profileAvatarSrc} alt={userProfile.displayName} />}
                    <AvatarFallback className="text-4xl">
                        {userProfile.displayName.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-3xl font-headline">{userProfile.displayName}</CardTitle>
                  {userProfile.bio && <CardDescription className="mt-2 text-lg">{userProfile.bio}</CardDescription>}
                </div>
            </CardHeader>
            <CardContent className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground"/>
                    <span className="text-muted-foreground">邮箱:</span>
                    <span className="font-medium">{userProfile.email || '未设置'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Cake className="w-5 h-5 text-muted-foreground"/>
                    <span className="text-muted-foreground">年龄:</span>
                    <span className="font-medium">{userProfile.age || '未设置'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VenetianMask className="w-5 h-5 text-muted-foreground"/>
                    <span className="text-muted-foreground">性别:</span>
                    <span className="font-medium">{displayGender}</span>
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <MapPin className="w-5 h-5 text-muted-foreground"/>
                    <span className="text-muted-foreground">位置:</span>
                    <span className="font-medium">{userProfile.address || '未设置'}</span>
                  </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
