// Shared by the overview, Research, and the build-time thumbnail generator.
// Leave src empty to show the placeholder until a final figure is available.
export const teaser = {
  src: "/quant-arena/teaser.jpg",
  alt: "Quant-Arena evaluates LLMs on complete quantitative research runs; banners show total scores on the iterative research track.",
  width: 1440,
  height: 810,
  placeholder: "Teaser figure (coming soon)",
  placeholderSrc: "/quant-arena/teaser-placeholder.svg",
};

export const teaserBanner = {
  src: teaser.src || teaser.placeholderSrc,
  alt: teaser.src ? teaser.alt : teaser.placeholder,
};
