// Génération en lot des images Business Horizon (Task 3)
// Usage: bun run scripts/generate-images.ts
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/home/z/my-project/public/images';

interface ImgSpec { file: string; prompt: string; size: string }

const STYLE = 'professional editorial photography for a business magazine, warm amber and golden tones, charcoal accents, high quality, detailed, no text, no watermark';

const IMAGES: ImgSpec[] = [
  { file: 'cover-entrepreneuriat-1', size: '1344x768', prompt: `Confident young entrepreneur working in modern coworking space, golden hour light, ${STYLE}` },
  { file: 'cover-entrepreneuriat-2', size: '1344x768', prompt: `Small business owner opening the door of her artisan workshop, morning light, ${STYLE}` },
  { file: 'cover-financement-1', size: '1344x768', prompt: `Venture capital business meeting, documents and growth charts on wooden table, handshake, ${STYLE}` },
  { file: 'cover-success-1', size: '1344x768', prompt: `Successful businesswoman on rooftop overlooking city skyline at sunrise, confident, ${STYLE}` },
  { file: 'cover-business-1', size: '1344x768', prompt: `Financial district skyline at dusk with glowing office windows, business magazine style, ${STYLE}` },
  { file: 'cover-business-2', size: '1344x768', prompt: `Professionals analyzing market charts on large screens in trading room, depth of field, ${STYLE}` },
  { file: 'cover-management-1', size: '1344x768', prompt: `Team leader presenting strategy to diverse team in glass meeting room, golden light, ${STYLE}` },
  { file: 'cover-management-2', size: '1344x768', prompt: `Executive mentoring a young manager in modern office lounge, candid moment, ${STYLE}` },
  { file: 'cover-startups-1', size: '1344x768', prompt: `Startup founders brainstorming with sticky notes on glass wall, energetic office, ${STYLE}` },
  { file: 'cover-startups-2', size: '1344x768', prompt: `Young tech team coding on laptops in startup office, warm light, shallow depth of field, ${STYLE}` },
  { file: 'cover-ia-1', size: '1344x768', prompt: `Abstract artificial intelligence neural network with glowing golden nodes on dark charcoal background, futuristic digital art, high quality` },
  { file: 'cover-ia-2', size: '1344x768', prompt: `Robot hand and human hand reaching toward each other, golden rim light, dark background, editorial tech photography, high quality` },
  { file: 'cover-interview-1', size: '1344x768', prompt: `Portrait of confident female CEO in her office, warm window light, charcoal background, ${STYLE}` },
  { file: 'cover-interview-2', size: '1344x768', prompt: `Portrait of a male startup founder in industrial modern office, candid smile, warm tones, ${STYLE}` },
  { file: 'cover-dossier-1', size: '1344x768', prompt: `Investigative desk with newspapers, magnifying glass and charts, moody warm lighting, ${STYLE}` },
  { file: 'cover-dossier-2', size: '1344x768', prompt: `Close-up of financial newspaper with rising chart and coffee cup, morning light, ${STYLE}` },
  { file: 'cover-tribune-1', size: '1344x768', prompt: `Empty auditorium stage with single microphone and spotlight, warm amber light, thought leadership concept, ${STYLE}` },
  { file: 'cover-evenement-1', size: '1344x768', prompt: `Business conference stage with large audience, golden stage lighting, wide shot, professional event photography, no text` },
  { file: 'podcast-1', size: '1024x1024', prompt: `Professional podcast studio with microphone and headphones, warm amber neon accents, dark moody background, high quality, no text` },
  { file: 'podcast-2', size: '1024x1024', prompt: `Two hosts recording a business podcast in studio with microphones, warm light, ${STYLE}` },
  { file: 'podcast-3', size: '1024x1024', prompt: `Vintage microphone with headphones on wooden desk, warm golden tones, podcast cover art, high quality, no text` },
  { file: 'podcast-4', size: '1024x1024', prompt: `Close-up of condenser microphone in professional recording booth, amber rim light, dark charcoal background, podcast cover art, high quality, no text` },
  { file: 'podcast-5', size: '1024x1024', prompt: `Business podcast interview setup, two chairs and microphones in elegant studio, warm golden ambience, podcast cover art, high quality, no text` },
  { file: 'ad-banner-1', size: '1440x704', prompt: `Sleek modern banking card floating with golden particles on dark amber gradient background, premium advertisement banner, wide composition, no text` },
  { file: 'ad-banner-2', size: '1440x704', prompt: `Cloud technology concept with glowing golden data streams over dark background, premium advertisement banner, wide composition, no text` },
  { file: 'ad-square-1', size: '1024x1024', prompt: `Rocket launching from a laptop screen, golden amber gradient background, square premium ad creative, no text, high quality` },
  { file: 'ad-native-1', size: '1344x768', prompt: `Businesswoman using tablet in bright modern office, warm tones, native advertising style, ${STYLE}` },
  { file: 'og-default', size: '1440x704', prompt: `Elegant desk with laptop showing financial charts, coffee cup, warm golden light, social media banner for business magazine, wide composition, no text` },
];

async function generateOne(zai: Awaited<ReturnType<typeof ZAI.create>>, spec: ImgSpec, attempt = 1): Promise<boolean> {
  const outPath = path.join(OUT_DIR, `${spec.file}.jpg`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
    console.log(`⏭  ${spec.file}.jpg existe déjà`);
    return true;
  }
  try {
    const response = await zai.images.generations.create({ prompt: spec.prompt, size: spec.size });
    const b64 = response.data?.[0]?.base64;
    if (!b64) throw new Error('réponse vide');
    const buffer = Buffer.from(b64, 'base64');
    await sharp(buffer).jpeg({ quality: 84 }).toFile(outPath);
    console.log(`✅ ${spec.file}.jpg (${Math.round(buffer.length / 1024)} Ko)`);
    return true;
  } catch (e) {
    console.error(`❌ ${spec.file} (tentative ${attempt}) : ${(e as Error).message}`);
    if (attempt < 6) {
      const wait = (e as Error).message.includes('429') ? 20000 * attempt : 2000 * attempt;
      await new Promise((r) => setTimeout(r, wait));
      return generateOne(zai, spec, attempt + 1);
    }
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zai = await ZAI.create();
  const failed: string[] = [];
  const CONCURRENCY = 2;
  let index = 0;
  async function worker(id: number) {
    // décalage initial pour éviter les rafales
    await new Promise((r) => setTimeout(r, id * 4000));
    while (index < IMAGES.length) {
      const spec = IMAGES[index++];
      const ok = await generateOne(zai, spec);
      // pause entre deux générations
      await new Promise((r) => setTimeout(r, 3000));
      if (!ok) failed.push(spec.file);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  console.log(failed.length === 0 ? '\n🎉 Toutes les images générées.' : `\n⚠️  Échecs : ${failed.join(', ')}`);
}
main();
