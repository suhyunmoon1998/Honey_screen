import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Honey Case Adventure",
    short_name: "Honey",
    description: "A respectful Honey investigation companion.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7efe7",
    theme_color: "#c66a2b",
    icons: [
      {
        src: "/honey-source.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
