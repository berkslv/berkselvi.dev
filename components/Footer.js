import React from "react";

export default function Footer({ heroPost }) {
  return (
    <footer class="w-full h-auto py-10 bg-prime-1000">
      <div class="md:w-6/12 w-10/12 container mx-auto">
        <div class="flex flex-col items-center justify-center">
          <h5 class="text-white">{heroPost.footer.title}</h5>
          <button
            id="change-lang"
            class="text-white px-2 py-1 bg-prime-800 hover:bg-prime-700 mt-4"
          >
            {heroPost.footer.button}
          </button>
        </div>
      </div>
    </footer>
  );
}
