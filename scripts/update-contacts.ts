// Script one-off : applique les VRAIS contacts de Réussite Magazine partout :
// SiteSetting (contactEmail / contactPhone) + pages statiques (mentions légales,
// politique de confidentialité, espace annonceurs).
// Idempotent : relançable sans risque.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_EMAIL = 'réussitemagazine16@gmail.com'
const NEW_PHONE = '+224 622 85 70 35 / 625 62 30 82'

async function upsertSetting(key: string, value: string) {
  const existing = await prisma.siteSetting.findUnique({ where: { key } })
  if (existing) {
    await prisma.siteSetting.update({ where: { key }, data: { value } })
  } else {
    await prisma.siteSetting.create({ data: { key, value } })
  }
  console.log(`✔ setting ${key} = ${value}`)
}

async function patchPage(slug: string, replacements: Array<[string, string]>) {
  const page = await prisma.staticPage.findUnique({ where: { slug } })
  if (!page) {
    console.log(`✖ page ${slug} introuvable`)
    return
  }
  let content = page.content
  let changed = false
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    await prisma.staticPage.update({ where: { slug }, data: { content } })
    console.log(`✔ page ${slug} mise à jour`)
  } else {
    console.log(`• page ${slug} déjà à jour`)
  }
}

async function main() {
  await upsertSetting('contactEmail', NEW_EMAIL)
  await upsertSetting('contactPhone', NEW_PHONE)

  await patchPage('mentions-legales', [
    ['Téléphone : +33 1 84 80 20 26.', `Téléphone : ${NEW_PHONE}.`],
    ['Courriel : contact@reussitemagazine.com.', `Courriel : ${NEW_EMAIL}.`],
  ])

  await patchPage('politique-confidentialite', [
    ['privacy@reussitemagazine.com', NEW_EMAIL],
  ])

  await patchPage('espace-annonceurs', [
    ['regie@reussitemagazine.com', NEW_EMAIL],
  ])

  // Vérification finale
  const stale = await prisma.staticPage.findMany({
    where: {
      OR: [
        { content: { contains: '+33 1 84 80 20 26' } },
        { content: { contains: '@reussitemagazine.com' } },
      ],
    },
    select: { slug: true },
  })
  console.log(stale.length ? `⚠ références restantes : ${stale.map((s) => s.slug).join(', ')}` : '✔ aucune référence obsolète restante dans les pages statiques')
}

main().finally(() => prisma.$disconnect())
