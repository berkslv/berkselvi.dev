import React from "react";

export default function Services({ heroPost }) {
  return (
    <section class="w-full h-auto  bg-prime-950">
      <div class="container mx-auto lg:px-16 md:px-12 sm:px-10 px-2 py-20">
        <div class="w-full text-center text-white">
          <h1 class="md:text-4xl text-3xl font-bold">
            {heroPost.services.title}
          </h1>
        </div>
        <div class="flex items-center flex-col justify-center md:mt-10 mt-0">
          <div class="flex md:flex-row flex-col w-full md:pt-16 pt-28">
            <div class="flex md:w-1/2 w-full items-start justify-center flex-col text-white p-6">
              <h3 class="md:text-2xl text-xl">
                {heroPost.services.section_1.title}
              </h3>
              <p class="pt-5 text-gray-200 font-light">
                {heroPost.services.section_1.subtitle}
              </p>
            </div>
            <div class="flex md:w-1/2 w-full items-center justify-center pt-15 md:pt-0 p-6">
              <img src={heroPost.services.section_1.img} alt="" />
            </div>
          </div>

          <div class="flex md:flex-row flex-col-reverse w-full md:pt-16 pt-28">
            <div class="flex md:w-1/2 w-full items-center justify-center p-6">
              <img src={heroPost.services.section_2.img} alt="" />
            </div>
            <div class="flex md:w-1/2 w-full items-start justify-center flex-col text-white mb-10 p-6">
              <h3 class="md:text-2xl text-xl">
                {heroPost.services.section_2.title}
              </h3>
              <p class="pt-5 text-gray-200 font-light">
                {heroPost.services.section_2.subtitle}
              </p>
            </div>
          </div>

          <div class="flex md:flex-row flex-col w-full md:pt-16 pt-28">
            <div class="flex md:w-1/2 w-full items-start justify-center flex-col text-white p-6">
              <h3 class="md:text-2xl text-xl">
                {heroPost.services.section_3.title}
              </h3>
              <p class="pt-5 text-gray-200 font-light">
                {heroPost.services.section_3.subtitle}
              </p>
            </div>
            <div class="flex md:w-1/2 w-full items-center justify-center pt-15 md:pt-0 p-6">
              <img src={heroPost.services.section_3.img} alt="" />
            </div>
          </div>

          <div class="flex md:flex-row flex-col-reverse w-full md:pt-16 pt-28">
            <div class="flex md:w-1/2 w-full items-center justify-center p-6">
              <img src={heroPost.services.section_4.img} alt="" />
            </div>
            <div class="flex md:w-1/2 w-full items-start justify-center flex-col text-white mb-10 p-6">
              <h3 class="md:text-2xl text-xl">
                {heroPost.services.section_4.title}
              </h3>
              <p class="pt-5 text-gray-200 font-light">
                {heroPost.services.section_4.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
