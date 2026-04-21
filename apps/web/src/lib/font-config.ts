type FontDefinition = {
  className: string;
};

// Keep the mapping local so builds do not need to fetch remote font assets.
export const FONT_CLASS_MAP = {
  Inter: "",
  Roboto: "",
  "Open Sans": "",
  "Playfair Display": "",
  "Comic Neue": "",
  Arial: "",
  Helvetica: "",
  "Times New Roman": "",
  Georgia: "",
} as const;

export const fonts = {
  inter: { className: "" },
  roboto: { className: "" },
  openSans: { className: "" },
  playfairDisplay: { className: "" },
  comicNeue: { className: "" },
} satisfies Record<string, FontDefinition>;

export const defaultFont: FontDefinition = { className: "" };
