import React from "react";

export default function Footer({ heroPost }) {
  return (
    <footer className="w-full h-auto py-10 bg-prime-1000">
      <div className="md:w-6/12 w-10/12 container mx-auto">
        <div className="flex flex-col items-center justify-center">
          <h5 className="text-white">{heroPost.footer.title}</h5>
          <button
            id="change-lang"
            className="text-white px-2 py-1 bg-prime-800 hover:bg-prime-700 mt-4"
          >
            {heroPost.footer.button}
          </button>
        </div>
      </div>
    </footer>
  );
}
