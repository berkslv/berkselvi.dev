import React from 'react'

export default function Toolbox({ heroPost }) {
    return (
    <section class="w-full h-auto bg-prime-1100">
        <div class="container mx-auto px-5 py-20">
            <div class="w-full text-center text-white">
                <h1 class="md:text-4xl text-3xl font-bold">{heroPost.toolbox.title}</h1>
            </div>
            <div class="w-full pt-5">
                <div class="flex flex-col justify-center items-center pt-10">
                    <div class="w-full text-center text-white">
                        <h1 class="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_1}</h1>
                    </div>
                    <div class="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img class="md:w-auto w-20 p-2" src="/assets/css.svg" alt="css" />
                        <img class="md:w-auto w-20 p-2" src="/assets/html.svg" alt="html" />
                        <img class="md:w-auto w-20 p-2" src="/assets/js.svg" alt="javascript" />
                        <img class="md:w-auto w-20 p-2" src="/assets/react.svg" alt="react" />
                        <img class="md:w-auto w-20 p-2" src="/assets/redux.svg" alt="redux" />
                        <img class="md:w-auto w-20 p-2" src="/assets/tailwind.svg" alt="tailwind" />
                    </div>
                </div>
                <div class="flex flex-col justify-center items-center pt-10">
                    <div class="w-full text-center text-white">
                        <h1 class="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_2}</h1>
                    </div>
                    <div class="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img class="md:w-auto w-20 p-2" src="/assets/node.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/csharp.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/mysql.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/mongo.svg" alt="" />
                    </div>
                </div>
                <div class="flex flex-col justify-center items-center pt-10">
                    <div class="w-full text-center text-white">
                        <h1 class="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_3}</h1>
                    </div>
                    <div class="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img class="md:w-auto w-20 p-2" src="/assets/git.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/github.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/wp.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/figma.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/aws.svg" alt="" />
                        <img class="md:w-auto w-20 p-2" src="/assets/namecheap.svg" alt="" />
                    </div>
                </div>
            </div>
        </div>
    </section>
    )
}
