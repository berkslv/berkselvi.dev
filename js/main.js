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
// Has padding
const paddingHorizontal = document.getElementsByClassName("px-5");

(() => {

    if (screen.width > 620) {
        for (let index = 0; index < mobileNavIcons.length; index++) {
            const element = mobileNavIcons[index];
            element.classList.remove("fa-lg");
            element.classList.add("fa-2x");
        }
    }

    if (screen.width < 620) {
        paddingHorizontal[0].classList.remove("px-5");
        paddingHorizontal[0].classList.remove("px-5");  
    }
})();

function randomNotification() {
    var notifTitle = 'bu bir test mesajıdır';
    var notifBody = 'Test mesajıdır';
    var notifImg = 'images/favicon.png';
    var options = {
        body: notifBody,
        icon: notifImg
    }
    var notif = new Notification(notifTitle, options);
}

document.getElementById("notif").addEventListener('click', function(e) {
    Notification.requestPermission().then(function(result) {
        if(result === 'granted') {
            setTimeout(() => {
                randomNotification();
            }, 4000);
        }
    });
});


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