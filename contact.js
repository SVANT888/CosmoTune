// Contact page JavaScript functionality
// Handles form submission, validation, and user feedback

// Keyboard navigation: focus first input on load
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("name").focus();
});

// Mo toast notification with gradient, centered, and longer duration
function showToast(message, type = "info") {
  const toast = document.getElementById("toastNotification");
  toast.textContent = message;
  toast.style.background = "linear-gradient(90deg,#3b82f6,#8b5cf6)";
  toast.style.color =
    type === "error" ? "#fee2e2" : type === "success" ? "#bbf7d0" : "#fff";
  toast.style.display = "block";
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 500);
  }, 6000);
}

// form handler (no backend)
document.addEventListener("DOMContentLoaded", function () {
  document.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    showToast(
      "Thank you for contacting us! We will get back to you soon.",
      "success"
    );
    this.reset();
    document.getElementById("name").focus();
  });
});
