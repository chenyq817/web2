
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: [
        '*.google.com',
        '*.firebase.app',
        '*.cloud.run',
        'localhost:9002',
        'www.your-cool-app.com',
      ],
    },
    serverComponentsExternalPackages: ['!raw-loader'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'news.hust.edu.cn',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'bkimg.cdn.bcebos.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tse1.mm.bing.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
