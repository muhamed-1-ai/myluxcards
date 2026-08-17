import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: "postgres://postgres:8lRk8Ft08J9hr5Po6CJtNcAH8LEybvB1jF7mfggtW2LiPpTJ3exVDKi4U7LLYJst@65.108.63.155:5432/postgres?sslmode=disable"
});

async function main() {
  const userId = "ab6c155a-a2dd-4e0b-ba1f-c4e344fb0185";
  const slug = "myluxcardz-174776";
  const profile = { name: "myluxcardz", title: "Title - Business name", profileBackground: "#020202" };
  try {
    const card = await prisma.digitalCard.create({
      data: { ownerId: userId, slug, profile: profile as any, active: false }
    });
    console.log("PRISMA CREATE SUCCESS! ID:", card.id, card.slug);
  } catch (err: any) {
    console.error("PRISMA CREATE ERROR:", err.code, err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
