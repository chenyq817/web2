
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2 } from 'lucide-react';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const signInSchema = z.object({
  email: z.string().email({ message: '无效的邮箱地址。' }),
  password: z.string().min(6, { message: '密码必须至少为6个字符。' }),
});

const signUpSchema = z.object({
  displayName: z.string().min(3, { message: '昵称必须至少为3个字符。' }),
  email: z.string().email({ message: '无效的邮箱地址。' }),
  password: z.string().min(6, { message: '密码必须至少为6个字符。' }),
});

type SignInFormValues = z.infer<typeof signInSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;

const defaultAvatars = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4'];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });


  const handleSignIn = async (values: SignInFormValues) => {
    setIsLoading(true);
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Firebase未初始化',
        });
        setIsLoading(false);
        return;
    }
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({ title: '登录成功！' });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '认证失败',
        description: '邮箱或密码不正确，请重试。',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    setIsLoading(true);
    if (!auth || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Firebase未初始化',
        });
        setIsLoading(false);
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const newUser = userCredential.user;

        await updateProfile(newUser, {
          displayName: values.displayName
        });
        
        const userProfileRef = doc(firestore, 'users', newUser.uid);
        const randomAvatarId = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
        
        const userProfileData = {
          displayName: values.displayName,
          displayName_lowercase: values.displayName.toLowerCase(),
          email: values.email,
          avatarId: randomAvatarId,
          bio: '',
          age: null,
          gender: '不愿透露',
          address: '',
          friendIds: [],
          friendRequestsSent: [],
          friendRequestsReceived: [],
        };
        
        // Use setDoc with merge:true which acts as an upsert.
        setDocumentNonBlocking(userProfileRef, userProfileData, { merge: true });

        toast({ title: '注册成功！请登录。' });
        setActiveTab('signin'); 
        signUpForm.reset();
        signInForm.reset({ email: values.email, password: '' });

    } catch (error: any) {
      let description = '发生未知错误，请稍后再试。';
      if (error.code === 'auth/email-already-in-use') {
        description = '该邮箱已被注册，请使用其他邮箱或直接登录。';
      } else if (error.code === 'auth/weak-password') {
        description = '密码强度太低，请使用更复杂的密码。';
      }
      toast({
        variant: 'destructive',
        title: '注册失败',
        description: description,
      });
    } finally {
        setIsLoading(false);
    }
  };

  
  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const logoImage = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-md">
        <CardHeader className="items-center text-center">
            {logoImage ? (
                <Image
                    src={logoImage.imageUrl}
                    alt={logoImage.description}
                    width={48}
                    height={48}
                    className="mb-2 rounded-full"
                />
            ) : (
                <Bot className="w-12 h-12 text-primary mb-2" />
            )}
            <CardTitle className="text-2xl font-headline">欢迎来到“I know hust”</CardTitle>
            <CardDescription>你的一站式校园生活伴侣。</CardDescription>
        </CardHeader>
        <div className='flex justify-center'>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="signin">登录</TabsTrigger>
                <TabsTrigger value="signup">注册</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="signin">
          <Card>
            <CardHeader>
              <CardTitle>登录</CardTitle>
              <CardDescription>输入您的凭据以访问您的帐户。</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <FormField
                      control={signInForm.control}
                      name="email"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={signInForm.control}
                      name="password"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      登录
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>注册</CardTitle>
              <CardDescription>创建一个新帐户以开始使用。</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <FormField
                      control={signUpForm.control}
                      name="displayName"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>昵称</FormLabel>
                          <FormControl>
                          <Input placeholder="您的昵称" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={signUpForm.control}
                      name="email"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      注册
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
