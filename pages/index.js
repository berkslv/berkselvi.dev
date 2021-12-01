import { getAllPosts, getHomePost } from "../lib/api";
import { useRouter } from "next/router";
import useLocale from "../lib/useLocale";
import Head from "next/head";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Services from "../components/Services";
import Projects from "../components/Projects";
import Toolbox from "../components/Toolbox";
import Footer from "../components/Footer";

export default function Index({ allPosts, homePost }) {
  const lang = useLocale(useRouter());

  const heroPost = homePost.filter((x) => x.file.includes(lang))[0];

  return (
    <>
      <Head>
        <title>
          {heroPost.shared.title}
        </title>
        <meta name="description" content={heroPost.shared.description}></meta>
      </Head>
      <Navbar heroPost={heroPost} />
      <Hero heroPost={heroPost} />
      <Services heroPost={heroPost} />
      <Projects heroPost={heroPost} />
      <Toolbox heroPost={heroPost} />
      <Footer heroPost={heroPost} />
    </>
  );
}

export async function getStaticProps() {
  const homePost = getHomePost([
    "hero",
    "social",
    "shared",
    "services",
    "projects",
    "toolbox",
    "footer",
  ]);

  const allPosts = getAllPosts([
    "hero",
    "social",
    "shared",
    "services",
    "projects",
    "toolbox",
    "footer",
  ]);

  return {
    props: { allPosts, homePost },
  };
}
