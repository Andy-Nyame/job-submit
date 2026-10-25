export const SEEDED_SERVICES = [
  {
    legacyNames: [] as string[],
    name: "Designing",
    slug: "designing",
    sortOrder: 10,
  },
  {
    legacyNames: ["SAV / Sticker Printing", "SAV/Sticker Printing"],
    name: "Sticker Printing",
    slug: "sav-sticker-printing",
    sortOrder: 20,
  },
  {
    legacyNames: [] as string[],
    name: "Poster Printing",
    slug: "poster-printing",
    sortOrder: 30,
  },
  {
    legacyNames: [] as string[],
    name: "Label Printing",
    slug: "label-printing",
    sortOrder: 40,
  },
  {
    legacyNames: ["Flexi / Banner Printing", "Flexi/Banner Printing"],
    name: "Banner Printing",
    slug: "flexi-banner-printing",
    sortOrder: 50,
  },
  {
    legacyNames: [] as string[],
    name: "Document Printing",
    slug: "document-printing",
    sortOrder: 60,
  },
  {
    legacyNames: ["For Sale Sticker Printing"],
    name: "For Sale Stickers",
    slug: "for-sale-sticker-printing",
    sortOrder: 70,
  },
  {
    legacyNames: [
      "Container Head/Batch Number Printing",
      "Container Head Sticker / Batch Numbers Printing",
      "Container Head / Batch Number Printing",
    ],
    name: "Container Head & Batch Number Printing",
    slug: "container-head-sticker-batch-numbers-printing",
    sortOrder: 80,
  },
  {
    legacyNames: [] as string[],
    name: "Website Design & Creation",
    slug: "website-design-creation",
    sortOrder: 90,
  },
] as const;

export function shouldReconcileSeededServiceName(
  currentName: string,
  service: (typeof SEEDED_SERVICES)[number],
) {
  return service.legacyNames.some((name) => name === currentName);
}
