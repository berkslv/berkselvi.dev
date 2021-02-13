// Work buttons
const pomodoroBtn = document.getElementById("pomodoro-li");
const derinBtn = document.getElementById("derin-li");
const medpicBtn = document.getElementById("medpic-li");
// Work elements
const pomodoro = document.getElementById("pomodoro");
const derin = document.getElementById("derin");
const medpic = document.getElementById("medpic");
// Mobile navbar icons
const mobileNavIcons = document.getElementById("custom-navbar").getElementsByTagName("i");

(() => {
    if (screen.width > 620) {
        for (let index = 0; index < mobileNavIcons.length; index++) {
            const element = mobileNavIcons[index];
            element.classList.remove("fa-lg");
            element.classList.add("fa-2x");
        }
    }
})();

/**
 * Makes class changes to handle clicking the tabs.
 * @param {this} e For the clicked element itself 
 */
const tabOnClick = (e) => {

    switch (e.innerText) {
        case "Pomodoro":
        pomodoro.classList.remove("is-none");
        derin.classList.add("is-none");
        medpic.classList.add("is-none");

        pomodoroBtn.classList.add("is-custom-active");
        derinBtn.classList.remove("is-custom-active");
        medpicBtn.classList.remove("is-custom-active");
            break;
        case "Derin":
        pomodoro.classList.add("is-none");
        derin.classList.remove("is-none");
        medpic.classList.add("is-none");

        pomodoroBtn.classList.remove("is-custom-active");
        derinBtn.classList.add("is-custom-active");
        medpicBtn.classList.remove("is-custom-active");
            break;
        case "Medpic":
        pomodoro.classList.add("is-none");
        derin.classList.add("is-none");
        medpic.classList.remove("is-none");

        pomodoroBtn.classList.remove("is-custom-active");
        derinBtn.classList.remove("is-custom-active");
        medpicBtn.classList.add("is-custom-active");
            break;
        default:
            console.error("Don't play with me!");
            break;
    }
}