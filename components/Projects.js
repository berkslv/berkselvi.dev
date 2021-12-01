import React from "react";

export default function Projects({ heroPost }) {
  return (
    <section id="projects" className="w-full h-auto container mx-auto px-5 py-20">
      <div className="w-full text-center text-white">
        <h1 className="md:text-4xl text-3xl font-bold">
          {heroPost.shared.projects}
        </h1>
      </div>
      <div className="w-full pt-10">
        <div className="flex md:flex-row flex-col-reverse">
          <div className="md:w-4/12 w-full flex flex-col justify-between items-start md:pt-8 pt-6 md:p-8 p-3 bg-pink-900">
            <div>
              <h5 className="md:text-lg text-base text-gray-200">
                {heroPost.projects.project_1.subtitle}
              </h5>
              <h4 className="md:text-4xl text-2xl text-white">
                {heroPost.projects.project_1.title}
              </h4>
              <p className="text-gray-300 font-light pt-4">
                {heroPost.projects.project_1.content}
              </p>
            </div>
            <a
              href={heroPost.projects.project_1.url}
              className="button-outline-white text-center w-full mt-5"
            >
              {heroPost.shared.visit}
            </a>
          </div>
          <div className="md:w-8/12 w-full bg-pink-500 p-7">
            <img src={heroPost.projects.project_1.img} alt="" />
          </div>
        </div>

        <div className="flex md:flex-row-reverse flex-col-reverse mt-10">
          <div className="md:w-4/12 w-full flex flex-col justify-between items-start md:pt-8 pt-6 md:p-8 p-3 bg-indigo-900">
            <div>
              <h5 className="md:text-lg text-base text-gray-200">
                {heroPost.projects.project_2.subtitle}
              </h5>
              <h4 className="md:text-4xl text-2xl text-white">
                {heroPost.projects.project_2.title}
              </h4>
              <p className="text-gray-300 font-light pt-4">
                {heroPost.projects.project_2.content}
              </p>
            </div>
            <a
              href={heroPost.projects.project_2.url}
              className="button-outline-white text-center w-full mt-5"
            >
              {heroPost.shared.visit}
            </a>
          </div>
          <div className="md:w-8/12 w-full bg-indigo-400 p-7">
            <img src={heroPost.projects.project_2.img} alt="" />
          </div>
        </div>

        <div className="flex md:flex-row flex-col-reverse mt-10">
          <div className="md:w-4/12 w-full flex flex-col justify-between items-start md:pt-8 pt-6 md:p-8 p-3 bg-pink-900">
            <div>
              <h5 className="md:text-lg text-base text-gray-200">
                {heroPost.projects.project_3.subtitle}
              </h5>
              <h4 className="md:text-4xl text-2xl text-white">
                {heroPost.projects.project_3.title}
              </h4>
              <p className="text-gray-300 font-light pt-4">
                {heroPost.projects.project_3.content}
              </p>
            </div>
            <a
              href={heroPost.projects.project_3.url}
              className="button-outline-white text-center w-full mt-5"
            >
              {heroPost.shared.visit}
            </a>
          </div>
          <div className="md:w-8/12 w-full bg-pink-500 p-7">
            <img src={heroPost.projects.project_3.img} alt="" />
          </div>
        </div>
      </div>
    </section>
  );
}
