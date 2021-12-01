import { getAllPosts } from '../lib/api'
import Head from 'next/head'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Services from '../components/Services'
import Projects from '../components/Projects'
import Toolbox from '../components/Toolbox'
import Footer from '../components/Footer'


export default function Index({ allPosts }) {
  const heroPost = allPosts[0]
  return (
    <>
        <Head>
          <title>Berk Selvi</title>
        </Head>
        <Navbar heroPost={heroPost} />
        <Hero heroPost={heroPost} />
        <Services heroPost={heroPost} />
        <Projects heroPost={heroPost} />
        <Toolbox heroPost={heroPost} />
        <Footer heroPost={heroPost} />
    </>
  )
}

export async function getStaticProps() {
  const allPosts = getAllPosts([
    'hero',
    'social',
    'shared',
    'services',
    'projects',
    'toolbox',
    'footer'
  ])

  return {
    props: { allPosts },
  }
}
