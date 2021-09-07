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
