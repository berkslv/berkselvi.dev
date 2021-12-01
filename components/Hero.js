import React from "react";
import Image from "next/image";
import parse from 'html-react-parser';


export default function Hero({ heroPost }) {
  return (
    <header className="w-full h-screen grid grid-cols-2 container mx-auto xl:px-60 lg:px-32 md:px-16 sm:px-10 px-5">
      <div className="md:col-span-1 col-span-2 flex items-center justify-center flex-col">
        <div>
          <h1 className="text-white md:text-5xl text-4xl w-full text-left">
            {parse(heroPost.hero.title)}
          </h1>
          <h2 className="text-gray-200 md:text-xl text-lg font-light w-full text-left pt-4">
            {parse(heroPost.hero.subtitle)}
          </h2>
        </div>
        <div className="w-full flex justify-start items-center pt-8">
          <div className="flex flex-col">
            <a href={heroPost.social.twitter.url}>
              <img
                src={heroPost.social.twitter.img}
                alt=""
                className="p-1 my-1 rounded-md transition-colors duration-150 active:bg-blue-500 hover:bg-blue-500"
              />
            </a>
            <a href={heroPost.social.instagram.url}>
              <img
                src={heroPost.social.instagram.img}
                alt=""
                className="p-1 my-1 rounded-md transition-colors duration-150 active:bg-blue-500 hover:bg-blue-500"
              />
            </a>
            <a href={heroPost.social.github.url}>
              <img
                src={heroPost.social.github.img}
                alt=""
                className="p-1 my-1 rounded-md transition-colors duration-150 active:bg-blue-500 hover:bg-blue-500"
              />
            </a>
            <a href={heroPost.social.linkedin.url}>
              <img
                src={heroPost.social.linkedin.img}
                alt=""
                className="p-1 my-1 rounded-md transition-colors duration-150 active:bg-blue-500 hover:bg-blue-500"
              />
            </a>
          </div>
          <div className="flex flex-col">
            <a
              href="mailto:berkselvi.dev@gmail.com"
              className="button-normal m-3 hire-me-btn"
            >
              {heroPost.shared.hire_me}
            </a>
            <a href="#projects" className="button-outline m-3 projects-btn">
              {heroPost.shared.projects}
            </a>
          </div>
        </div>
      </div>
      <div className="hidden md:col-span-1 col-span-2 md:flex items-center justify-center">
        <img src={heroPost.hero.img} alt="" />
      </div>
    </header>
  );
}
