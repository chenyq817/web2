
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';
import Image from 'next/image';
import { createNewsSnippet } from '@/ai/flows/create-news-flow';
import { updateNewsFiles } from './actions';

const newsSchema = z.object({
  title: z.string().min(5, { message: '标题必须至少为5个字符。' }),
  content: z.string().min(20, { message: '内容必须至少为20个字符。' }),
  category: z.enum(['学术', '体育', '校园生活', '其他'], { required_error: '请选择一个分类。' }),
  imageBase64: z.string().refine(val => val.startsWith('data:image/'), { message: '请上传一张图片。' }),
});

type NewsFormValues = z.infer<typeof newsSchema>;

export default function CreateNewsPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      title: '',
      content: '',
      category: undefined,
      imageBase64: '',
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          variant: 'destructive',
          title: '图片过大',
          description: '请上传小于2MB的图片。',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue('imageBase64', base64String, { shouldDirty: true });
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    form.setValue('imageBase64', '', { shouldDirty: true });
    setImagePreview(null);
  };

  const onSubmit = async (data: NewsFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Call the Genkit flow to get the code snippets as strings
      const snippets = await createNewsSnippet(data);
      
      // 2. Call the new server action to update the files on the server
      const result = await updateNewsFiles({
        newsItemString: snippets.newsItemString,
        imageItemString: snippets.imageItemString,
      });

      if (result.success) {
        toast({
          title: '发布成功！',
          description: '新闻发布成功。请刷新页面查看最新应用状态。',
        });
        form.reset();
        setImagePreview(null);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('发布新闻时出错:', error);
      toast({
        variant: 'destructive',
        title: '发布失败',
        description: error instanceof Error ? error.message : '发生未知错误，请稍后再试。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="发布新闻" />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>创建新闻</CardTitle>
              <CardDescription>填写下面的表单来发布一篇新文章。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" {...form.register('title')} />
                  {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">分类</Label>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择新闻分类" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="学术">学术</SelectItem>
                          <SelectItem value="体育">体育</SelectItem>
                          <SelectItem value="校园生活">校园生活</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.category && <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">内容</Label>
                  <Textarea id="content" {...form.register('content')} rows={10} />
                  {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>特色图片</Label>
                  <Card className="border-dashed">
                    <CardContent className="p-6">
                      {imagePreview ? (
                        <div className="relative group w-full aspect-video">
                          <Image src={imagePreview} alt="图片预览" fill className="object-contain rounded-md" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Button variant="destructive" size="icon" onClick={removeImage}>
                              <X className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">请上传一张图片</p>
                          <Button asChild variant="outline" className="mt-4">
                            <label>
                              <Upload className="mr-2 h-4 w-4" /> 上传图片
                              <input type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleImageUpload} />
                            </label>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                   {form.formState.errors.imageBase64 && <p className="text-sm text-destructive">{form.formState.errors.imageBase64.message}</p>}
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    发布新闻
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
