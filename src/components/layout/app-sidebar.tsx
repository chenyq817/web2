"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Newspaper,
  Users,
  Shield,
  FileText,
  MessageSquare,
  PlusCircle,
  Bot,
} from "lucide-react";
import { useUser } from "@/firebase";
import { PlaceHolderImages } from "@/lib/placeholder-images";

const menuItems = [
  { href: "/", label: "主页", icon: LayoutDashboard },
  { href: "/news", label: "新闻", icon: Newspaper },
  { href: "/post", label: "帖子", icon: FileText },
  { href: "/social", label: "社交", icon: Users },
  { href: "/community", label: "社区", icon: MessageSquare },
  { href: "/ai-chat", label: "AI 问答", icon: Bot },
];

const adminMenuItems = [
    { href: "/admin", label: "管理后台", icon: Shield },
    { href: "/admin/create-news", label: "发布新闻", icon: PlusCircle },
]


export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  
  const isAdmin = user?.email === 'admin@111.com';
  
  // 您可以在 @/lib/placeholder-images.json 文件中修改 ID 为 'app-logo' 的图片来更换这里的 Logo
  const logoImage = PlaceHolderImages.find(img => img.id === 'app-logo');

  const isActive = (href: string) => {
    if (href === '/') {
        return pathname === href;
    }
    // For admin, check for exact match, otherwise use startsWith
    if(href.startsWith('/admin')) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          {logoImage && (
            <Image
              src={logoImage.imageUrl}
              alt={logoImage.description}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <h1 className="text-xl font-semibold font-headline text-sidebar-foreground">
            I know hust
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                href={item.href}
                isActive={isActive(item.href)}
                tooltip={item.label}
                className="text-base"
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        
        {isAdmin && (
          <SidebarMenu className="mt-auto">
            {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                    href={item.href}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="text-base"
                >
                    <item.icon />
                    <span>{item.label}</span>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
      </SidebarContent>
      <SidebarFooter>
        {/* User profile button removed from here, now handled by UserNav in Header */}
      </SidebarFooter>
    </Sidebar>
  );
}
