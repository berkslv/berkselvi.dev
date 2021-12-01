import React from "react";

export default function Navbar() {
  return (
    <nav class="w-full flex justify-between items-center md:px-10 px-3 py-2 fixed top-0 bg-prime-1000">
      <h3 class="text-white font-bold text-sm">Berk Selvi</h3>
      <a
        href="mailto:berkselvi.dev@gmail.com"
        class="hire-me-btn box-border border-4 border-blue-500 bg-blue-500 px-4 py-1 text-white font-semibold text-sm uppercase transition-colors duration-150 hover:bg-blue-600 hover:border-blue-600"
      >
        Hire Me
      </a>
    </nav>
  );
}
