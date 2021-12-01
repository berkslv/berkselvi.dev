import React from "react";

export default function Meta({ heroPost }) {
  return (
    <>
      <meta property="og:site_name" content={heroPost.shared.title} />
      <meta property="og:title" content={heroPost.shared.title} />
      <meta property="og:url" content="https://berkselvi.dev" />
      <meta
        property="og:image"
        content="https://raw.githubusercontent.com/berkslv/berkselvi.dev/main/dist/assets/img/preview.jpeg"
      />
      <meta property="og:description" content={heroPost.shared.description} />
      <meta property="og:type" content="website" />
      <meta property="og:image:width" content="1417" />
      <meta property="og:image:height" content="955" />
      <meta property="twitter:title" content={heroPost.shared.title} />
      <meta
        property="twitter:description"
        content={heroPost.shared.description}
      />
      <meta property="twitter:card" content="summary_large_image" />
      <meta
        property="twitter:image"
        content="https://raw.githubusercontent.com/berkslv/berkselvi.dev/main/dist/assets/img/preview.jpeg"
      />
      <meta property="twitter:image:alt" content="Website preview" />

      <title>{heroPost.shared.title}</title>
      <meta name="description" content={heroPost.shared.description} />
      <meta name="theme-color" content="#202029" />
      
      <script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-JKZ8XL30H6"
      ></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag() { dataLayer.push(arguments); }
              gtag('js', new Date());

              gtag('config', 'G-JKZ8XL30H6');
          `,
        }}
      ></script>
      
    </>
  );
}
