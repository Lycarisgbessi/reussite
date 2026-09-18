import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const settings = await db.siteSetting.findMany({ select: { key: true } });
console.log('settings keys:', settings.map(s => s.key).join(', '));
const one = await db.article.findFirst({ where: { title: { contains: 'Levée' } }, select: { slug: true, featured: true, status: true, views: true } });
console.log('article levée:', one);
const published = await db.article.count({ where: { status: 'PUBLISHED' } });
console.log('published:', published);
await db.$disconnect();
