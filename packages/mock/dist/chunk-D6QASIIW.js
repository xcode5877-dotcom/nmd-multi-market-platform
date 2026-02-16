// src/quick-start-templates.ts
import { generateId } from "@nmd/core";
var CLOTHING_TEMPLATE = {
  hero: {
    title: "\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643",
    subtitle: "\u0627\u0643\u062A\u0634\u0641 \u0623\u062D\u062F\u062B \u0635\u064A\u062D\u0627\u062A \u0627\u0644\u0645\u0648\u0636\u0629",
    ctaText: "\u062A\u0633\u0648\u0642 \u0627\u0644\u0622\u0646",
    ctaLink: "#",
    ctaHref: "#"
  },
  banners: [
    {
      id: "banner-1",
      imageUrl: "https://placehold.co/1200x400/e2e8f0/64748b?text=\u0639\u0631\u0636+\u062E\u0627\u0635",
      title: "\u0639\u0631\u0636 \u062E\u0627\u0635",
      subtitle: "\u062E\u0635\u0648\u0645\u0627\u062A \u062D\u062A\u0649 30%",
      ctaText: "\u062A\u0633\u0648\u0642\u064A \u0627\u0644\u0622\u0646",
      ctaHref: "#",
      enabled: true,
      sortOrder: 0
    },
    {
      id: "banner-2",
      imageUrl: "https://placehold.co/1200x400/f1f5f9/475569?text=\u0639\u0631\u0636+\u0645\u062D\u062F\u0648\u062F",
      title: "\u0639\u0631\u0636 \u0645\u062D\u062F\u0648\u062F",
      subtitle: "\u064A\u0646\u062A\u0647\u064A \u0642\u0631\u064A\u0628\u0627\u064B",
      ctaText: "\u0627\u0643\u062A\u0634\u0641\u064A",
      ctaHref: "#",
      enabled: true,
      sortOrder: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
      showCountdown: true
    },
    {
      id: "banner-3",
      imageUrl: "https://placehold.co/1200x400/ede9fe/6d28d9?text=\u0648\u0635\u0644+\u062D\u062F\u064A\u062B\u0627\u064B",
      title: "\u0648\u0635\u0644 \u062D\u062F\u064A\u062B\u0627\u064B",
      subtitle: "\u0645\u0648\u062F\u064A\u0644\u0627\u062A \u062C\u062F\u064A\u062F\u0629",
      ctaText: "\u0639\u0631\u0636 \u0627\u0644\u0643\u0644",
      ctaHref: "#",
      enabled: true,
      sortOrder: 2
    }
  ],
  categoryNames: ["\u0641\u0633\u0627\u062A\u064A\u0646", "\u0628\u0644\u0627\u064A\u0632", "\u0628\u0646\u0627\u0637\u064A\u0644", "\u062C\u0627\u0643\u064A\u062A\u0627\u062A", "\u0623\u0637\u0642\u0645"],
  optionGroupDefs: [
    { name: "\u0645\u0642\u0627\u0633\u0627\u062A \u0645\u0644\u0627\u0628\u0633", type: "SIZE", itemNames: ["S", "M", "L", "XL"] },
    { name: "\u0623\u0644\u0648\u0627\u0646 \u0634\u0627\u0626\u0639\u0629", type: "COLOR", itemNames: ["\u0623\u0633\u0648\u062F", "\u0623\u0628\u064A\u0636", "\u0628\u064A\u062C", "\u0623\u0632\u0631\u0642", "\u0648\u0631\u062F\u064A"] }
  ]
};
function buildClothingTemplateForTenant(tenantId) {
  const categories = CLOTHING_TEMPLATE.categoryNames.map((name, i) => ({
    id: generateId(),
    tenantId,
    name,
    slug: name.toLowerCase().replace(/\s/g, "-"),
    sortOrder: i,
    parentId: null,
    isVisible: true
  }));
  const optionGroups = CLOTHING_TEMPLATE.optionGroupDefs.map((def) => ({
    id: generateId(),
    tenantId,
    name: def.name,
    type: def.type,
    required: def.type === "SIZE",
    minSelected: def.type === "SIZE" ? 1 : 0,
    maxSelected: 1,
    selectionType: "single",
    items: def.itemNames.map((name, i) => ({
      id: generateId(),
      name,
      sortOrder: i
    }))
  }));
  return {
    hero: { ...CLOTHING_TEMPLATE.hero },
    banners: CLOTHING_TEMPLATE.banners.map((b) => ({ ...b, id: generateId() })),
    categories,
    optionGroups
  };
}

export {
  CLOTHING_TEMPLATE,
  buildClothingTemplateForTenant
};
//# sourceMappingURL=chunk-D6QASIIW.js.map