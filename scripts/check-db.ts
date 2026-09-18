import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const featured = await db.article.findMany({ where: { featured: true }, select: { slug: true, status: true, publishedAt: true, featuredOrder: true } });
console.log('featured count:', featured.length);
featured.forEach(f => console.log(' -', f.featuredOrder, f.status, f.publishedAt?.toISOString(), f.slug));
const hb = await db.siteSetting.findUnique({ where: { key: 'homeBlocks' } });
console.log('homeBlocks:', hb?.value?.slice(0, 300));
await db.$disconnect();
