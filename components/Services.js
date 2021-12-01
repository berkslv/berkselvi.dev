import React from "react";

export default function Services({ heroPost }) {
  return (
    <section className="w-full h-auto  bg-prime-950">
      <div className="container mx-auto lg:px-16 md:px-12 sm:px-10 px-2 py-20">
        <div className="w-full text-center text-white">
          <h1 className="md:text-4xl text-3xl font-bold">
            {heroPost.services.title}
          </h1>
        </div>
        <div className="flex items-center flex-col justify-center md:mt-10 mt-0">
          <div className="flex md:flex-row flex-col w-full md:pt-16 pt-28">
            <div className="flex md:w-1/2 w-full items-start justify-center flex-col text-white p-6">
              <h3 className="md:text-2xl text-xl">
                {heroPost.services.section_1.title}
              </h3>
              <p className="pt-5 text-gray-200 font-light">
                {heroPost.services.section_1.subtitle}
              </p>
            </div>
            <div className="flex md:w-1/2 w-full items-center justify-center pt-15 md:pt-0 p-6">
              <img src={heroPost.services.section_1.img} alt="" />
            </div>
          </div>

          <div className="flex md:flex-row flex-col-reverse w-full md:pt-16 pt-28">
            <div className="flex md:w-1/2 w-full items-center justify-center p-6">
              <img src={heroPost.services.section_2.img} alt="" />
            </div>
            <div className="flex md:w-1/2 w-full items-start justify-center flex-col text-white mb-10 p-6">
              <h3 className="md:text-2xl text-xl">
                {heroPost.services.section_2.title}
              </h3>
              <p className="pt-5 text-gray-200 font-light">
                {heroPost.services.section_2.subtitle}
              </p>
            </div>
          </div>

          <div className="flex md:flex-row flex-col w-full md:pt-16 pt-28">
            <div className="flex md:w-1/2 w-full items-start justify-center flex-col text-white p-6">
              <h3 className="md:text-2xl text-xl">
                {heroPost.services.section_3.title}
              </h3>
              <p className="pt-5 text-gray-200 font-light">
                {heroPost.services.section_3.subtitle}
              </p>
            </div>
            <div className="flex md:w-1/2 w-full items-center justify-center pt-15 md:pt-0 p-6">
              <img src={heroPost.services.section_3.img} alt="" />
            </div>
          </div>

          <div className="flex md:flex-row flex-col-reverse w-full md:pt-16 pt-28">
            <div className="flex md:w-1/2 w-full items-center justify-center p-6">
              <img src={heroPost.services.section_4.img} alt="" />
            </div>
            <div className="flex md:w-1/2 w-full items-start justify-center flex-col text-white mb-10 p-6">
              <h3 className="md:text-2xl text-xl">
                {heroPost.services.section_4.title}
              </h3>
              <p className="pt-5 text-gray-200 font-light">
                {heroPost.services.section_4.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
