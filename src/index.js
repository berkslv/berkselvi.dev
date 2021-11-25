import smoothscroll from "smoothscroll-polyfill";
import Alpine from "alpinejs";

//--------------------------------------- smoothscroll
smoothscroll.polyfill();

//--------------------------------------- alpine
window.Alpine = Alpine;
Alpine.start();

//--------------------------------------- for faq accordion
const faq_button = document.querySelectorAll(".faq-btn");
faq_button.forEach((btn) => {
  btn.addEventListener("click", () => {
    let faq_icon_classes = btn.querySelector(".faq-icon").classList;
    if (faq_icon_classes.contains("-rotate-90")) {
      faq_icon_classes.remove("-rotate-90");
    } else {
      faq_icon_classes.add("-rotate-90");
    }
  });
});

//--------------------------------------- projects button scrool behavior
const projects_btn = document.querySelector(".projects-btn");
projects_btn.addEventListener("click", () => {
  const projects_section_top = document.getElementById("projects").offsetTop;
  window.scroll({ top: projects_section_top, left: 0, behavior: "smooth" });
});

//--------------------------------------- submit form events
const sent_modal = document.getElementById("sent-modal");

/**
 * Opens modal with classes
 */
function openModal(modal) {
  modal.classList.remove("invisible");
  modal.classList.remove("opacity-0");
  modal.classList.add("opacity-100");

  setTimeout(() => {
    closeModal(modal);
  }, 1500);
}

/**
 * Closes modal with classes
 */
function closeModal(modal) {
  modal.classList.remove("opacity-100");
  modal.classList.add("opacity-0");
  modal.classList.add("invisible");
}

if (window.location.hash === "#hire-me-sent") {
  openModal(sent_modal);
} else {
  closeModal(sent_modal);
}
