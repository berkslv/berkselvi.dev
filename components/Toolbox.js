import React from 'react'

export default function Toolbox({ heroPost }) {
    return (
    <section className="w-full h-auto bg-prime-1100">
        <div className="container mx-auto px-5 py-20">
            <div className="w-full text-center text-white">
                <h1 className="md:text-4xl text-3xl font-bold">{heroPost.toolbox.title}</h1>
            </div>
            <div className="w-full pt-5">
                <div className="flex flex-col justify-center items-center pt-10">
                    <div className="w-full text-center text-white">
                        <h1 className="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_1}</h1>
                    </div>
                    <div className="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img className="md:w-auto w-20 p-2" src="/assets/css.svg" alt="css" />
                        <img className="md:w-auto w-20 p-2" src="/assets/html.svg" alt="html" />
                        <img className="md:w-auto w-20 p-2" src="/assets/js.svg" alt="javascript" />
                        <img className="md:w-auto w-20 p-2" src="/assets/react.svg" alt="react" />
                        <img className="md:w-auto w-20 p-2" src="/assets/redux.svg" alt="redux" />
                        <img className="md:w-auto w-20 p-2" src="/assets/tailwind.svg" alt="tailwind" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center pt-10">
                    <div className="w-full text-center text-white">
                        <h1 className="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_2}</h1>
                    </div>
                    <div className="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img className="md:w-auto w-20 p-2" src="/assets/node.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/csharp.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/mysql.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/mongo.svg" alt="" />
                    </div>
                </div>
                <div className="flex flex-col justify-center items-center pt-10">
                    <div className="w-full text-center text-white">
                        <h1 className="md:text-2xl text-xl font-bold">{heroPost.toolbox.subtitle_3}</h1>
                    </div>
                    <div className="w-full flex flex-row flex-wrap justify-center items-center pt-5">
                        <img className="md:w-auto w-20 p-2" src="/assets/git.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/github.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/wp.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/figma.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/aws.svg" alt="" />
                        <img className="md:w-auto w-20 p-2" src="/assets/namecheap.svg" alt="" />
                    </div>
                </div>
            </div>
        </div>
    </section>
    )
}
