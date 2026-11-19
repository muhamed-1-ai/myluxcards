import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/super-admin/",
          "/orders/",
          "/api/",
          "/reset-password",
          "/setup-password",
          "/forbidden",
        ],
      },
    ],
    sitemap: "https://3gzappit.com/sitemap.xml",
  };
}
