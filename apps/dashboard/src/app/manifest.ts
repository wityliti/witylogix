import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Witylogix Dashboard",
    short_name: "Witylogix",
    description:
      "Delivery logistics command center. Real-time fleet tracking, route optimization, and delivery management.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#0a0a0f",
    background_color: "#0a0a0f",
    categories: ["business", "productivity"],
    screenshots: [
      {
        src: "/screenshots/dashboard-mobile.png",
        sizes: "540x720",
        form_factor: "narrow",
        type: "image/png",
      },
      {
        src: "/screenshots/dashboard-desktop.png",
        sizes: "1920x1080",
        form_factor: "wide",
        type: "image/png",
      },
    ],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Fleet Tracking",
        short_name: "Tracking",
        description: "View real-time fleet tracking",
        url: "/tracking?source=pwa",
        icons: [{ src: "/shortcut-tracking.png", sizes: "192x192" }],
      },
      {
        name: "Route Optimization",
        short_name: "Routes",
        description: "Optimize delivery routes",
        url: "/routing?source=pwa",
        icons: [{ src: "/shortcut-routing.png", sizes: "192x192" }],
      },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
