let accordian = document.getElementsByClassName("FAQ__title");

for (let i = 0; i < accordian.length; i++) {
  accordian[i].addEventListener("click", function () {
    if (this.childNodes[1].classList.contains("fa-plus")) {
      this.childNodes[1].classList.remove("fa-plus");
      this.childNodes[1].classList.add("fa-times");
    } else {
      this.childNodes[1].classList.remove("fa-times");
      this.childNodes[1].classList.add("fa-plus");
    }

    let content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
}

// 1. Create the array of "password" emails
const allowedEmails = [
  "chithrukasri@gmail.com",
  "ntkobeysekara@gmail.com"
  // You can add more emails here separated by commas
];

// 2. Select all "Get Started" buttons on the page
const getStartedButtons = document.querySelectorAll(".primary__button");

// 3. Add a click event to each button
getStartedButtons.forEach(button => {
  button.addEventListener("click", function (event) {
    event.preventDefault(); // Prevents any default form submission behavior

    // Find the specific input box that sits next to the clicked button
    const formContainer = this.closest(".email__form__container");
    const emailInput = formContainer.querySelector(".email__input");
    
    // Get the typed email, convert to lowercase, and remove extra spaces
    const enteredEmail = emailInput.value.trim().toLowerCase();

    // 4. Check if the entered email is in our array
    if (allowedEmails.includes(enteredEmail)) {
      // Redirect to Chithruka if there's a match
      window.location.href = "https://chithruka.github.io/Chithruka/";
    } else {
      // Redirect to SpectraFlix if there's no match
      window.location.href = "https://spectraflix.blogspot.com/";
    }
  });
});